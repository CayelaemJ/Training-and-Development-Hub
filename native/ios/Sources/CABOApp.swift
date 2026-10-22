import SwiftUI
import WebKit
import UIKit

// Proof-of-concept iOS shell; replace this pilot URL with CABO's permanent
// production origin and complete account/sign-in testing before distribution.
private enum CABO {
    static let home = URL(string: "https://cabo-learning-hub-pilot.onrender.com/")!

    static func permits(_ url: URL) -> Bool {
        guard url.scheme == "https", let host = url.host?.lowercased() else { return false }
        return host == home.host || host == "replit.com" ||
            host.hasSuffix(".replit.com") || host == "accounts.google.com"
    }
}

@main
struct CABOLearningHubApp: App {
    var body: some Scene {
        WindowGroup {
            CABOHome()
        }
    }
}

private struct CABOHome: View {
    @State private var reloadToken = 0

    var body: some View {
        NavigationStack {
            CABOWebView(reloadToken: reloadToken)
                .navigationTitle("CABO Learning Hub")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            reloadToken += 1
                        } label: {
                            Label("Reload learning hub", systemImage: "arrow.clockwise")
                        }
                    }
                    ToolbarItemGroup(placement: .bottomBar) {
                        ShareLink(item: CABO.home) {
                            Label("Share CABO", systemImage: "square.and.arrow.up")
                        }
                        Spacer()
                        Button {
                            UIApplication.shared.open(CABO.home)
                        } label: {
                            Label("Open in Safari", systemImage: "safari")
                        }
                    }
                }
        }
        .tint(Color(red: 196 / 255, green: 103 / 255, blue: 58 / 255))
    }
}

private struct CABOWebView: UIViewRepresentable {
    let reloadToken: Int

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        view.scrollView.contentInsetAdjustmentBehavior = .automatic
        view.load(URLRequest(url: CABO.home, cachePolicy: .reloadRevalidatingCacheData))
        return view
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.lastReloadToken != reloadToken {
            context.coordinator.lastReloadToken = reloadToken
            webView.reload()
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var lastReloadToken = 0

        func webView(_ webView: WKWebView,
                     decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let destination = action.request.url else {
                decisionHandler(.cancel)
                return
            }
            if CABO.permits(destination) {
                decisionHandler(.allow)
                return
            }
            // Only a user's explicit link tap may open an untrusted destination.
            // OIDC redirects to other identity providers require deliberate
            // review and native auth integration, not wildcard allowlisting.
            if action.navigationType == .linkActivated,
               ["https", "mailto", "tel"].contains(destination.scheme ?? "") {
                UIApplication.shared.open(destination)
            }
            decisionHandler(.cancel)
        }

        func webView(_ webView: WKWebView,
                     decidePolicyFor response: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            decisionHandler(CABO.permits(response.response.url ?? CABO.home) ? .allow : .cancel)
        }
    }
}
