import Foundation
import SwiftUI
import AuthenticationServices
import CryptoKit
import Security
import UIKit

// Native iOS sign-in uses the system-owned authentication browser session.
// No WKWebView, password handling, or web-cookie copying.
struct GuardianInvitation: Identifiable {
    let id: Int
    let status: String
    let learnerName: String?
    let verifiedForRead: Bool
}
struct StaffSchool: Identifiable {
    let id: Int
    let subjects: [String]
    let support: [String]
    let tickets: [String]
    let notice: String?
}

@MainActor
final class NativeSession: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published var status = "Sign in to load your CABO learning records."
    @Published var busy = false
    @Published var role: String?
    @Published var summary: [String] = []
    @Published var workspaces: [String] = []
    @Published var materials: [String] = []
    @Published var quizzes: [String] = []
    @Published var quizSummaries: [NativeQuizSummary] = []
    @Published var guardians: [GuardianInvitation] = []
    @Published var guardianGuidance = ""
    @Published var staffSchools: [StaffSchool] = []
    @Published var journey: [String] = []
    @Published var learnerHelp: [String] = []

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
            let verifiedRole = decoded["role"] as? String ?? "learner"
            let nextSummary = (decoded["summary"] as? [String: Int] ?? [:])
                .map { "\($0.key): \($0.value)" }.sorted()
            let nextWorkspaces = (decoded["cards"] as? [[String: Any]] ?? [])
                .compactMap { $0["label"] as? String }
            var nextGuardians: [GuardianInvitation] = []
            var nextStaff: [StaffSchool] = []
            var nextJourney: [String] = []
            var nextLearnerHelp: [String] = []
            var nextMaterials: [String] = []
            var nextQuizzes: [String] = []
            var nextQuizSummaries: [NativeQuizSummary] = []
            var nextGuidance = ""

            if verifiedRole == "parent" {
                let parentData = try await request("api/native/mobile/parent")
                let parent = try JSONSerialization.jsonObject(with: parentData) as? [String: Any] ?? [:]
                nextGuidance = parent["guidance"] as? String ?? ""
                nextGuardians = (parent["relationships"] as? [[String: Any]] ?? []).compactMap { item in
                    guard let id = item["invitationId"] as? Int,
                          let status = item["status"] as? String else { return nil }
                    return GuardianInvitation(
                        id: id, status: status,
                        learnerName: item["learnerName"] as? String,
                        verifiedForRead: item["verifiedForRead"] as? Bool ?? false
                    )
                }
            } else if ["teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head"]
                        .contains(verifiedRole) {
                let organizations = Array((decoded["organizationIds"] as? [Int] ?? []).prefix(12))
                for org in organizations {
                    do {
                        let data = try await request("api/organizations/\(org)/support/options")
                        let options = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
                        let courses = (options["courses"] as? [[String: Any]] ?? [])
                            .compactMap { $0["name"] as? String }
                        var support: [String] = []
                        if let stats = try? await request("api/organizations/\(org)/support/accountability"),
                           let obj = try? JSONSerialization.jsonObject(with: stats) as? [String: Any],
                           let summary = obj["summary"] as? [String: Int] {
                            support = summary.map { "\($0.key): \($0.value)" }.sorted()
                        }
                        var ticketNames: [String] = []
                        if let data = try? await request("api/organizations/\(org)/support"),
                           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                            ticketNames = Array((obj["items"] as? [[String: Any]] ?? []).prefix(20))
                                .compactMap { ticket in
                                    guard let concept = ticket["concept"] as? String else { return nil }
                                    return "\(String(concept.prefix(80))) · \(ticket["status"] as? String ?? "open")"
                                }
                        }
                        nextStaff.append(StaffSchool(
                            id: org, subjects: courses, support: support, tickets: ticketNames, notice: nil
                        ))
                    } catch {
                        // Do not treat authorization failure as an empty classroom.
                        if keychainToken() == nil { throw error }
                        nextStaff.append(StaffSchool(
                            id: org, subjects: [], support: [], tickets: [],
                            notice: "This school's learning-support module may not be enabled."
                        ))
                    }
                }
            } else {
                nextMaterials = (try? JSONDecoder().decode([NativeResource].self,
                    from: await request("api/materials")))?.prefix(30).map(\.title) ?? []
                nextQuizSummaries = Array((try? JSONDecoder().decode([NativeQuizSummary].self,
                    from: await request("api/quizzes")))?.prefix(30) ?? [])
                nextQuizzes = nextQuizSummaries.map(\.title)
                for org in Array((decoded["organizationIds"] as? [Int] ?? []).prefix(3)) {
                    if let data = try? await request("api/organizations/\(org)/support"),
                       let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        let items = Array((obj["items"] as? [[String: Any]] ?? []).prefix(15))
                        nextLearnerHelp += items.compactMap { row in
                            guard let topic = row["concept"] as? String else { return nil }
                            return "\(String(topic.prefix(80))) · \(row["status"] as? String ?? "open")"
                        }
                    }
                }
                if let data = try? await request("api/learner-journey/me"),
                   let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let stages = (obj["journeys"] as? [Any])?.count ?? 0
                    let milestones = (obj["milestones"] as? [Any])?.count ?? 0
                    nextJourney = ["Learning stages: \(stages)", "Milestones: \(milestones)"]
                }
            }
            // One of the nested requests may have cleared credentials after a 401.
            guard keychainToken() != nil else { throw NSError(domain: "CABO", code: 401) }
            role = verifiedRole
            summary = nextSummary
            workspaces = nextWorkspaces
            guardians = nextGuardians
            guardianGuidance = nextGuidance
            staffSchools = nextStaff
            journey = nextJourney
            learnerHelp = Array(nextLearnerHelp.prefix(20))
            materials = nextMaterials
            quizzes = nextQuizzes
            quizSummaries = nextQuizSummaries
            status = "Connected securely to CABO"
        } catch {
            role = nil; summary = []; workspaces = []; materials = []; quizzes = []; quizSummaries = []; quizSummaries = []
            guardians = []; staffSchools = []; journey = []; learnerHelp = []; guardianGuidance = ""
            status = keychainToken() == nil
                ? "Session expired. Sign in again."
                : "Could not load CABO. Check your connection and retry."
        }
    }

    // Source-of-truth practice assessment API. All results are returned by the server;
    // no correct answers or fabricated grades are built into the app.
    func loadQuiz(id: Int) async throws -> NativePracticeQuiz {
        guard role != nil, id > 0 else { throw NSError(domain: "CABO", code: 401) }
        let data = try await request("api/quizzes/\(id)")
        return try JSONDecoder().decode(NativePracticeQuiz.self, from: data)
    }

    func submitQuiz(id: Int, answers: [Int]) async throws -> NativeQuizAttempt {
        guard role != nil, id > 0, !answers.isEmpty, answers.allSatisfy({ $0 >= 0 }) else {
            throw NSError(domain: "CABO", code: 400)
        }
        let payload = try JSONEncoder().encode(NativeQuizAnswers(answers: answers))
        let data = try await request("api/quizzes/\(id)/attempts",
                                     method: "POST", body: payload)
        return try JSONDecoder().decode(NativeQuizAttempt.self, from: data)
    }

    private struct NativeQuizAnswers: Encodable {
        let answers: [Int]
    }

    func decideGuardian(invitationId: Int, accept: Bool) async {
        guard !busy, invitationId > 0 else { return }
        busy = true
        do {
            let body = try JSONSerialization.data(withJSONObject: [
                "decision": accept ? "accepted" : "declined"
            ])
            _ = try await request(
                "api/guardian-relationships/\(invitationId)/decision",
                method: "POST", body: body
            )
            busy = false
            await refresh()
            status = accept ? "Invitation accepted. School verification is still required."
                            : "Invitation declined."
        } catch {
            busy = false
            status = "Unable to update invitation. Please retry."
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
        guardians = []; staffSchools = []; journey = []; guardianGuidance = ""
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
