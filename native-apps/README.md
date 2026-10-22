# CABO native application programme — implementation progress

**Status:** genuine Android Compose and iOS SwiftUI clients with secure native sign-in source and read-only learner data screens. Native Windows WinUI 3 remains an initial signed-out preview. **Not production-ready, compiled, device-tested or published.**

These are standalone native interfaces, **not browser wrappers, PWAs or React WebViews**. The existing PR #40 web application stays available as a separate channel.

## Platform delivery

| Platform | Implemented in this branch | Still required |
| --- | --- | --- |
| Android — Kotlin / Jetpack Compose | CABO-branded native UI; OIDC login via system browser and one-time PKCE bridge; Android Keystore encrypted verifier, state and short-lived session; authenticated role dashboard, material and quiz titles; native logout | Real Android Studio/Gradle compile, emulator/device test, full native quiz-taking, upload picker, offline strategy, signed APK/AAB |
| iOS — Swift / SwiftUI | Native learning sections; ASWebAuthenticationSession + PKCE; iOS Keychain bearer storage; live role dashboard, material and quiz titles; native sign-out; XcodeGen definition | Real Xcode compile, iPhone/iPad tests, upload picker, interactive assessments, app signing and TestFlight/App Store review |
| Windows — C# / WinUI 3 | Initial XAML UI and backend reachability | Native OAuth redirect, Windows DPAPI/credential vault storage, dashboard, documents, packaging, Windows builds and QA |
| Web — React + TypeScript | Previously merged PR #40 | Existing web release gates remain unchanged |

## Auth architecture and release safety

CABO's web login uses cookie sessions and Replit OIDC. **A native browser window opening `/api/login` alone does NOT authenticate an app.** This branch introduces a separate native PKCE authorization-code bridge that uses the existing OIDC login in the system browser and a **fixed, registered redirect per native client**. Codes are 256-bit random, hashed at rest, bound to a SHA-256 PKCE verifier, expire after 180 seconds and are atomically consumed. Only Android and iOS redirects are currently enabled in the allowlist. Successful exchange creates a separate one-hour bearer session in the existing sessions table, without copying OIDC refresh tokens to the device. Android uses Android Keystore and iOS uses Keychain; native API requests use the bearer only over HTTPS.

Endpoints:
- `GET /api/native/authorize?client_id=cabo-android|cabo-ios&code_challenge=...&code_challenge_method=S256&state=...` — browser phase, logs users in through existing CABO OIDC when needed.
- `POST /api/native/token` with `client_id`, `code`, `code_verifier` — atomic one-time exchange.
- `POST /api/native/logout` — revokes an authenticated native bearer session.
- `GET /api/portal/me`, `GET /api/materials`, `GET /api/quizzes` — existing role- and account-scoped endpoints, now also callable with native bearer sessions.

### Feature flag remains OFF by default

1. Review/apply `lib/db/migrations/20261022_native_auth_codes.sql` in an isolated test database using the existing reviewed migration process. Never run unchecked Drizzle push against production.
2. Confirm the target environment supports working **browser OIDC** authentication and the registered `/api/callback` URL. Test passwords / Railway test accounts are **not** interchangeable with the real OIDC integration.
3. Configure `CABO_NATIVE_AUTH_ENABLED=true` **server-side only**, on an isolated environment after migration and verification. Do not add the flag to frontend `VITE_*` variables. Leave this disabled in production until tested.
4. Open the Android or iOS native sign-in flow; confirm exact custom-scheme callback routing, PKCE state comparison, code replay rejection, expired-code rejection, bearer scoping, logout/revocation, and cross-account isolation.
5. Before public release, replace the hard-coded **Render pilot** URL with a CABO-controlled permanent HTTPS origin, use app-claimed verified HTTPS redirects (Android App Links / iOS Universal Links), and register the exact production package/bundle identifiers and domain associations. Custom-scheme callbacks in this pilot are protected by PKCE but are not equivalent to verified HTTPS ownership.
6. Schedule cleanup of expired codes; monitor attempts without logging codes, verifiers, tokens, test answers or personal student profiles.

Do not enable native authorization on a live school database without rollback, audit, penetration testing, device signing and tenant-access verification. The 60-minute token limit reduces exposure but doesn't substitute for credential revocation and device-loss procedures.

## Build and validation

**API / policies:** `node --test artifacts/api-server/src/tests/nativeAuthPolicy.test.mjs`, `pnpm run typecheck`, `pnpm run build`. Existing GitHub/CircleCI CI should also pass; unit policy tests **do not prove** the migration, endpoint integration, or mobile sign-in works.

**Android:** Open `native-apps/android` in Android Studio with Android SDK 35, JDK 17, and compatible Gradle 8.11.1+, generate/add a Gradle wrapper, sync and run `:app` on an emulator. APK and AAB generation remain follow-on work. **No Android build was performed in this PR authoring environment.** The new GitHub manual workflow is currently defined only on this feature branch; GitHub generally requires a workflow_dispatch definition on the default branch to appear as a manual action. Treat it as proposed build tooling until reviewed and registered on the default branch, not a presently downloadable APK.

**iOS:** On a Mac with Xcode 15+ and XcodeGen, run `cd native-apps/ios && xcodegen generate`, open `CABOLearningHub.xcodeproj`, select a development team, run on an iPhone/iPad. **No Xcode build or TestFlight upload has been performed.**

**Windows:** Open `native-apps/windows/CABO.Native/CABO.Native.csproj` in Visual Studio with Windows App SDK/WinUI 3 workload. No signed Windows installer is available.

## Next feature milestone

After real physical-device native sign-in works: implement a **complete learner practice-test interaction** on Android and iOS (load quiz details, choose an answer, submit once, display score and source feedback) using the existing CABO API. Follow with document upload selection and write-safe offline drafts, then Windows parity. Educator, parent, guardian and government portals require separate authorized native experiences; never show routes based solely on the client-supplied role.

Security notes: no AI provider key is embedded in any client, no second learner database is created, and the native UI must never assume that a network failure means a submission failed or can be retried blindly.

Relevant native OAuth best practice: https://www.rfc-editor.org/rfc/rfc8252.html
