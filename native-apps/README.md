# CABO genuinely native applications — initial implementation

**These are native user-interface projects, NOT websites embedded in WebViews.** The web application (PR #40) remains separately available. These projects are early native developer previews, not complete learner applications, not signed binaries, and not store-ready.

| Platform | Language / framework | Implemented today |
|---|---|---|
| Android | Kotlin + Jetpack Compose | Native Material 3 dashboard, learning-area cards, HTTPS service-status check and browser login handoff |
| iPhone/iPad | Swift + SwiftUI | Native navigation/list UI, learning-area sections, URLSession service check and Safari login handoff |
| Windows | C# + Windows App SDK / WinUI 3 | Native XAML layout, service-status HTTP check and browser login handoff |
| Web | Existing React + TypeScript | Unchanged full web application |

The native previews **do not yet access learner records**. The current CABO backend uses same-origin session cookies and web OpenID Connect redirects. Opening Safari/Chrome/Edge for login does *not* authenticate these apps. Do not fake an authenticated result or copy session cookies. Next deliverable is a securely registered native OIDC Authorization Code + PKCE flow using system-browser authentication, verified redirect ownership, encrypted operating-system credential storage, backend audience-validated access tokens, logout/revocation, and tenant-scoped API calls. All native platforms must use the same production backend with no new learner database.

## Build environments

Android: install Android Studio/JDK 17 and Android SDK 35, open `native-apps/android`, install Gradle wrapper on a developer machine and build/run `:app`. The repository currently has no Gradle wrapper binary; no Android APK was compiled here.

iOS: create an Xcode iOS SwiftUI project named CABOLearningHub, add the two Swift source files under `native-apps/ios`, choose CABO-owned bundle ID and signing, and run on iPhone/iPad. This is SwiftUI source only, not a complete generated Xcode project or signed IPA.

Windows: open `native-apps/windows/CABO.Native/CABO.Native.csproj` with Visual Studio 2022 + Windows App SDK support on Windows, restore NuGet, compile and verify WinUI/XAML. This is not yet an MSIX/EXE installer pipeline.

## Hard release gates and work order

1. Agree a CABO-owned permanent HTTPS origin. Replace the **isolated Render pilot URLs** in all native clients before distribution.
2. Specify native auth contract (OIDC PKCE; secure redirect URIs; no password-in-app or broad CORS; device-bound platform storage and per-role access).
3. Define versioned OpenAPI DTOs for learner profile, dashboard, materials, quiz creation/attempts, learning journey, educator support and safe error envelopes; add contract tests against the same backend.
4. Implement login, profile, material library, native quiz, upload picker and result feedback end-to-end on Android first; port to SwiftUI and WinUI 3 with equivalent accessibility.
5. Add usable offline **read-only** learning cache and encrypted, conflict-aware drafts only after consent, data lifecycle and reconnection design. Never silently replay marks, uploads or submissions.
6. Validate physical Android/iOS, Windows, and browser releases with multi-account isolation, child-data protections, screen readers and network interruptions. Build signed Android APK/AAB, Apple IPA/TestFlight, and Windows MSIX/EXE after those checks.
7. Keep native API keys/server AI credentials out of all clients, never hard-code test identities, and never share genuine learner data in synthetic testing.

This starts the actual native rewrite rather than claiming the current web workflows are already native.
