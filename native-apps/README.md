# CABO native application programme — implementation progress

**Status:** genuine Android Compose and iOS SwiftUI native clients with teacher/learner tablet layouts and parent smartphone flows; native sign-in source, scoped course/support reads, guardian invitation decisions, plus native iOS and Android quiz-taking, material readers and restricted admin registry screens. Windows WinUI 3 now includes a native loopback PKCE browser sign-in client, DPAPI token storage, logout and read-only role-scoped records, pending Windows build and runtime verification. **iOS simulator build and a prior Android debug build passed in CI; physical devices, authentication integration and production release remain unverified.**

These are standalone native interfaces, **not browser wrappers, PWAs or React WebViews**. The existing PR #40 web application stays available as a separate channel.

## Platform delivery

| Platform | Implemented in this branch | Still required |
| --- | --- | --- |
| Android — Kotlin / Jetpack Compose | CABO-branded responsive phone/tablet UI; OIDC login via system browser and one-time PKCE bridge; Android Keystore token encryption; learner materials/quizzes/journey/help requests; educator assigned courses and authorized ticket queues; parents accept/decline invitations with verified-child privacy restrictions; native logout | API 23 emulator/device test, uploaded document picker, offline drafts, native sign-in integration, signed release AAB |
| iOS — Swift / SwiftUI | Adaptive iPhone/iPad SwiftUI parent/learner/educator screens; ASWebAuthenticationSession + PKCE; iOS Keychain bearer storage; live role data, assigned teaching subjects, restricted parent invite decisions, authorized support queues; native quiz fetching, answer selection, submission and genuine grading feedback (UNCOMPILED); native sign-out; callback Info.plist and XcodeGen definition | iPhone/iPad physical tests, native sign-in and submission integration, upload picker, signed build and TestFlight/App Store review |
| Windows — C# / WinUI 3 | WinUI 3 desktop UI; Windows loopback PKCE callback to the shared API; DPAPI CurrentUser secure token storage, logout and account-scoped read-only learner/admin dashboards | Windows CI compile and live login test, interactive quizzes and material previews, native teacher/guardian views, MSIX packaging and Windows lab QA |
| Web — React + TypeScript | Previously merged PR #40 | Existing web release gates remain unchanged |

## Inclusive device and role delivery

- Android target lowered from API 26 to **API 23 (Android 6.0)**; iOS deployment target lowered from 17.0 to **15.0**. These are proposed floors pending native toolchain/hardware testing; they cannot guarantee compatibility with every Android phone or iPhone ever manufactured.
- Android tablet 600dp+ uses two panes. iPad regular size class uses two panes. Phones get a single-column interface with the same permitted functions.
- Teachers get assigned subjects and available learner-support queues; learners get their own study materials, practice test listings, journey counts and support statuses; parents get pending invitations, accept/decline operations, and minimal verified connection details.
- Guardian names must not be disclosed until institutional verification AND an active learner enrolment. A pending/accepted invitation alone does not give access to reports. Role and access are decided by the backend, not by device model or display width.
- No expensive GPU, fingerprint reader, high-end camera or Play Services feature is a product prerequisite. Old Android/iOS below the minimum native OS must use a separately tested web fallback where secure browser technology permits it.
- **Compatibility and device validation plan:** [DEVICE_INCLUSION_MATRIX.md](DEVICE_INCLUSION_MATRIX.md). Static test guards exist in `nativeDeviceInclusion.test.mjs`; they are not equivalent to simulator/device builds.

## Auth architecture and release safety

CABO's web login uses cookie sessions and Replit OIDC. **A native browser window opening `/api/login` alone does NOT authenticate an app.** This branch introduces a separate native PKCE authorization-code bridge that uses the existing OIDC login in the system browser and a **fixed, registered redirect per native client**. Codes are 256-bit random, hashed at rest, bound to a SHA-256 PKCE verifier, expire after 180 seconds and are atomically consumed. Android, iOS and a fixed Windows loopback redirect are explicitly pinned in the native callback allowlist. The Windows listener must be bound to 127.0.0.1 before browser sign-in. Successful exchange creates a separate one-hour bearer session in the existing sessions table, without copying OIDC refresh tokens to the device. Android uses Android Keystore and iOS uses Keychain; native API requests use the bearer only over HTTPS.

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

**Android:** Open `native-apps/android` in Android Studio with Android SDK 35, JDK 17, and compatible Gradle 8.11.1+; emulate API 23 and low-memory Android phones, generate/add a Gradle wrapper, sync and run `:app` on an emulator. The GitHub Actions Android job now compiles a DEBUG (not release-signed) APK for PRs. A prior Android compilation passed. Download any passing debug artifact from the matching Actions run, never distribute it as an institution release. API23 emulator and low-end physical devices remain untested.

**iOS:** On a Mac with Xcode and XcodeGen with a toolchain able to compile iOS 15 deployment targets, run `cd native-apps/ios && xcodegen generate`, open `CABOLearningHub.xcodeproj`, select a development team, run on an iPhone/iPad. GitHub's macOS runner has successfully compiled the unsigned iOS Simulator target. No TestFlight upload, signed physical iPhone build or real-device login has been performed.

**Windows:** Native WinUI 3 source is under `native-apps/windows/CABO.Native`. The new Windows GitHub Actions job uses Visual Studio MSBuild for WinUI resource tasks, not standalone dotnet CLI. The fixed localhost callback `http://127.0.0.1:47787/auth` must be tested on actual Windows 10/11 devices with the isolated CABO native-auth test server. Windows displays real role data after login, but assessment-taking, upload, packaging and installer validation are not yet complete. No signed Windows installer is available.

## Next feature milestone

After real physical-device native sign-in works: validate **the iOS learner practice-test interaction on a signed physical build**, then implement Android quiz parity, educator response/marking actions, and guardian-authorised child reports (load quiz details, choose an answer, submit once, display score and source feedback) using the existing CABO API. Follow with document upload selection and write-safe offline drafts, then Windows parity. Educator, parent, guardian and government portals require separate authorized native experiences; never show routes based solely on the client-supplied role.

Security notes: no AI provider key is embedded in any client, no second learner database is created, and the native UI must never assume that a network failure means a submission failed or can be retried blindly.

Relevant native OAuth best practice: https://www.rfc-editor.org/rfc/rfc8252.html

## iOS practice assessment implementation (unverified on device)

`NativeQuizView.swift` now requests each learner-owned quiz using `GET /api/quizzes/:id`, renders its real server-provided questions and answer options, then sends answers to `POST /api/quizzes/:id/attempts`. The server returns the persisted score and question explanations. The screen prevents duplicate taps and treats a failed/uncertain submission as potentially committed, so it does **not** offer blind retries. **Server-level durable idempotency is still pending**, as is recovery of an attempt after an interrupted network response. This is practice feedback, not teacher-approved certification. Add native build and signed-in API integration tests before declaring the feature delivered.

## Native quiz reliability (review-gated database migration)

The iOS and Android clients now open learner-owned materials, fetch actual practice questions, submit answers and display persisted marks/feedback. Both send a per-attempt `Idempotency-Key` and offer a read-only status lookup after an interrupted response. No native client blindly re-submits on an unknown outcome.

To activate **durable** de-duplication, review and apply `lib/db/migrations/20261023_quiz_idempotency.sql` on an **isolated** Neon test database before setting `CABO_QUIZ_IDEMPOTENCY_ENABLED=true` in its corresponding Render API service. The backend uses a unique `(user_id, request_key)` index and returns the same result for a matching duplicate. If the flag stays off, prior web behavior continues and native status lookup cannot confirm submission, so **do not describe the submission as fully reliable across network interruptions**. No production migrations were applied in this iteration.

## Superadmin test account

The requested `cabo_test` account is supported by the existing isolated test-login gate, with a server-side scrypt hash generated using `scripts/configure-cabo-test-login.mjs`. The plaintext password is not committed to any file or app. See `native-apps/TEST_ADMIN_SETUP.md`. **The account has not been activated in Render because the currently public pilot's database isolation and permissions have not been verified.** Never elevate this test principal on a school/production database. Native OIDC login is a separate integration gate, and no native sign-in claim is made based on browser test credentials.

## What's still outstanding

- Backend: apply/test native authorization and quiz idempotency migrations on disposable environments; confirm tenant isolation, replay, session expiry, lost-response recovery and role permissions with real authenticated requests.
- iOS: signed physical-device install, consented file uploads, secure offline drafts, iOS15 low-end and iPad accessibility QA, TestFlight.
- Android: compile/debug artifact review on latest commit, API23 emulator and physical-device acceptance, uploads, offline drafts, battery/data performance, signed release AAB.
- Windows: implement native sign-in/session storage and verified user workflows, MSIX packaging, Windows-runner compilation and lab-computer QA.
- All: school pilots, POPIA review, DPIA as appropriate for children's records, educator review and guardian boundaries; launch remains blocked until these checks pass.

## Windows native authentication boundary

The Windows pilot opens the system browser and starts a short-lived loopback listener bound specifically to 127.0.0.1:47787. It uses PKCE S256, a 256-bit random state, verifies the returned code before exchange, and stores only the CABO session token with DPAPI CurrentUser on Windows. Successful API reads use Bearer over HTTPS; sign-out revokes the session where online and clears local encrypted credentials regardless of network availability. Unlike the prior preview, merely opening a web login is no longer presented as authenticating the native app.

This new code has **not** been validated on a physical Windows machine. It uses a fixed callback port to limit server redirect targets; if that port is occupied, sign-in should fail closed. Before broader rollout, move to dynamic RFC8252 loopback ports and test endpoint and binding security, device timeouts, DPAPI recovery, proxy behavior, school lab profiles and WinUI desktop accessibility. Review the OIDC registration/legacy test account distinction. No production credentials or child records should be used in these tests.
