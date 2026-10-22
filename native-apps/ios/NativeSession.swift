import Foundation
import SwiftUI
import AuthenticationServices
import CryptoKit
import Security
import UIKit

// Native iOS sign-in uses the system-owned authentication browser session.
// No WKWebView, password handling, or web-cookie copying.
@MainActor
final class NativeSession: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published var status = "Sign in to load your CABO learning records."
    @Published var busy = false
    @Published var role: String?
    @Published var summary: [String] = []
    @Published var workspaces: [String] = []
    @Published var materials: [String] = []
    @Published var quizzes: [String] = []

    private let origin = URL(string: "https://cabo-learning-hub-pilot.onrender.com")!
    private let clientID = "cabo-ios"
    private let redirectScheme = "cabo-learninghub-ios"
    private var browserSession: ASWebAuthenticationSession?
    private var pendingVerifier: String?
    private var pendingState: String?

    private func randomBase64URL() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let result = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        precondition(result == errSecSuccess)
        return Data(bytes).base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    private func base64URL(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }.first(where: { $0.isKeyWindow }) ?? UIWindow()
    }

    func signIn() {
        guard !busy else { return }
        let verifier = randomBase64URL()
        let state = randomBase64URL()
        pendingVerifier = verifier
        pendingState = state
        let challenge = base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        var components = URLComponents(url: origin.appendingPathComponent("api/native/authorize"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state)
        ]
        guard let url = components.url else {
            status = "Cannot create a secure sign-in request."
            return
        }
        busy = true
        status = "Opening CABO secure sign-in…"
        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: redirectScheme) { [weak self] callback, error in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.browserSession = nil
                defer { self.pendingVerifier = nil; self.pendingState = nil }
                guard error == nil, let callback,
                      callback.scheme == self.redirectScheme,
                      callback.host == "auth",
                      let query = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems,
                      let code = query.first(where: { $0.name == "code" })?.value,
                      let returnedState = query.first(where: { $0.name == "state" })?.value,
                      returnedState == self.pendingState, let savedVerifier = self.pendingVerifier else {
                    self.busy = false
                    self.status = "Sign-in cancelled or verification failed. Try again."
                    return
                }
                await self.exchange(code: code, verifier: savedVerifier)
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        browserSession = session
        if !session.start() {
            busy = false
            browserSession = nil
            pendingVerifier = nil
            pendingState = nil
            status = "Unable to open secure sign-in."
        }
    }

    private func request(_ path: String, method: String = "GET", body: Data? = nil, authorized: Bool = true) async throws -> Data {
        var request = URLRequest(url: origin.appendingPathComponent(path))
        request.httpMethod = method
        request.timeoutInterval = 12
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if authorized {
            guard let token = keychainToken() else { throw NSError(domain: "CABO", code: 401) }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let code = (response as? HTTPURLResponse)?.statusCode else { throw NSError(domain: "CABO", code: 0) }
        if code == 401 {
            clearToken()
            throw NSError(domain: "CABO", code: 401)
        }
        guard (200...299).contains(code) else { throw NSError(domain: "CABO", code: code) }
        return data
    }

    private func exchange(code: String, verifier: String) async {
        do {
            let body = try JSONSerialization.data(withJSONObject: [
                "client_id": clientID, "code": code, "code_verifier": verifier
            ])
            let data = try await request("api/native/token", method: "POST", body: body, authorized: false)
            guard let response = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let token = response["access_token"] as? String,
                  token.count >= 32,
                  response["token_type"] as? String == "Bearer",
                  let expiration = response["expires_in"] as? Int,
                  (1...3600).contains(expiration) else {
                throw NSError(domain: "CABO", code: 400)
            }
            try storeToken(token)
            busy = false
            await refresh()
        } catch {
            busy = false
            status = "Could not complete native CABO login. Please try again."
        }
    }

    func restore() async {
        if keychainToken() != nil { await refresh() }
    }
    func refresh() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let portal = try await request("api/portal/me")
            let decoded = try JSONSerialization.jsonObject(with: portal) as? [String: Any] ?? [:]
            role = decoded["role"] as? String ?? "learner"
            summary = (decoded["summary"] as? [String: Int] ?? [:]).map { "\($0.key): \($0.value)" }.sorted()
            workspaces = (decoded["cards"] as? [[String: Any]] ?? []).compactMap { $0["label"] as? String }
            materials = (try? JSONDecoder().decode([NativeResource].self, from: await request("api/materials")))?.prefix(8).map(\.title) ?? []
            quizzes = (try? JSONDecoder().decode([NativeResource].self, from: await request("api/quizzes")))?.prefix(8).map(\.title) ?? []
            // A nested request may have invalidated the token; never display
            // an authenticated screen after a 401 from materials or quizzes.
            if keychainToken() == nil { throw NSError(domain: "CABO", code: 401) }
            status = "Connected securely to CABO"
        } catch {
            role = nil; summary = []; workspaces = []; materials = []; quizzes = []
            status = keychainToken() == nil ? "Session expired. Please sign in." : "Unable to load CABO. Check your connection and retry."
        }
    }

    func signOut() async {
        guard !busy else { return }
        busy = true
        // Revoke server-side token while still available, then always clear it
        // from Keychain even when the network is unavailable.
        if let token = keychainToken() {
            var request = URLRequest(url: origin.appendingPathComponent("api/native/logout"))
            request.httpMethod = "POST"
            request.timeoutInterval = 6
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            _ = try? await URLSession.shared.data(for: request)
        }
        clearToken()
        role = nil; summary = []; workspaces = []; materials = []; quizzes = []
        status = "Signed out on this device."
        busy = false
    }

    private struct NativeResource: Decodable { let title: String }

    private func keychainToken() -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "za.co.cabosolutions.learninghub.native",
            kSecAttrAccount as String: "native_bearer",
            kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    private func storeToken(_ token: String) throws {
        clearToken()
        let attributes: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "za.co.cabosolutions.learninghub.native",
            kSecAttrAccount as String: "native_bearer",
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData as String: Data(token.utf8)]
        guard SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess else {
            throw NSError(domain: "CABO", code: 500)
        }
    }
    private func clearToken() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "za.co.cabosolutions.learninghub.native",
            kSecAttrAccount as String: "native_bearer"]
        SecItemDelete(query as CFDictionary)
    }
}
