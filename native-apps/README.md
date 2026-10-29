# CABO native application programme — implementation progress

**Status:** Kotlin/Jetpack Compose Android and Swift/SwiftUI iOS clients exist, but both are partial implementations and do not yet provide parity with the role-filtered web application. Android emulator/APK and iOS Simulator checks have passed on earlier revisions; this branch's new iOS upload flow still needs its CI build. Android Studio setup is documented in [android/README.md](android/README.md). These are test builds, not signed store or production releases. Physical-device acceptance, live authentication on a user device and release installation remain unverified.

These are standalone native interfaces, **not browser wrappers, PWAs or React WebViews**. The existing web application is a separate channel and is the capability reference, not a substitute for the native deliverable. The [native feature-parity register](FEATURE_PARITY.md) records the current gaps and acceptance gates.

## Platform delivery

| Platform | Implemented in this branch | Still required |
| --- | --- | --- |
| Android — Kotlin / Jetpack Compose | CABO-branded responsive phone/tablet UI; OIDC login via system browser and one-time PKCE bridge; Android Keystore token and encrypted support-draft storage; learner materials/quizzes/journey/help requests; authenticated learner upload picker for supported private study documents; educator assigned courses and authorized ticket queues; parents accept/decline invitations with verified-child privacy restrictions; native logout; API 23 emulator tests and debug APK builds passed | Physical-device and live storage acceptance; authenticated native sign-in on a physical device; signed release AAB |
| iOS — Swift / SwiftUI | Adaptive iPhone/iPad role screens; ASWebAuthenticationSession + PKCE; iOS Keychain bearer storage; learner/parent reports, parent invitation decisions, educator assignment summaries, material reading and practice-quiz submit/recovery; native material upload flow in progress | Full native route parity; support actions/drafts; educator assessment, marking, attendance and school operations; administration; Simulator CI for upload changes; physical-device tests, signed build and TestFlight/App Store review |
| Windows — C# / WinUI 3 | WinUI 3 desktop UI; Windows loopback PKCE callback to the shared API; DPAPI CurrentUser secure token storage, logout and account-scoped read-only learner/admin dashboards | live login test, interactive quizzes and material previews, native teacher/guardian views, MSIX packaging and Windows lab QA |
| Web — React + TypeScript | Previously merged PR #40 | Existing web release gates remain unchanged |

## Inclusive device and role delivery

- Android target lowered from API 26 to **API 23 (Android 6.0)**; iOS deployment target lowered from 17.0 to **15.0**. These are proposed floors pending native toolchain/hardware testing; they cannot guarantee compatibility with every Android phone or iPhone ever manufactured.
- Android tablet 600dp+ uses two panes. iPad regular size class uses two panes. Phones get a single-column interface with the same permitted functions.
- Teachers get assigned subjects and available learner-support queues; learners get their own study materials, practice test listings, journey counts and support statuses; parents get pending invitations, accept/decline operations, and minimal verified connection details.
- Guardian names must not be disclosed until institutional verification AND an active learner enrolment. A pending/accepted invitation alone does not give access to reports. Role and access are decided by the backend, not by device model or display width.
- No expensive GPU, fingerprint reader, high-end camera or Play Services feature is a product prerequisite. Old Android/iOS below the minimum native OS must use a separately tested web fallback where secure browser technology permits it.
- **Compatibility and device validation plan:** [DEVICE_INCLUSION_MATRIX.md](DEVICE_INCLUSION_MATRIX.md).

## Android emulator and internal build workflow

- CI runs instrumentation tests on an Android 6.0 / API 23 emulator, the current minimum supported Android version.
- The tests cover the default secure sign-in screen, hidden-by-default test credentials, quiz answer requirements, one-shot submission behavior, uncertain-submission recovery, learner written-exam marking, and assignment-scoped exam submission.
- Each run creates a standard debug APK and a separate short-retention test APK pinned to the isolated Render preview. Neither build contains account credentials or release signing keys.
- The test-login APK is for the isolated dummy-data service only. Never redistribute it as a production app.

## Native parity acceptance

Do not label the app full-featured until every route and allowed-role flow in [FEATURE_PARITY.md](FEATURE_PARITY.md) has a native implementation and passes its completion gate on Android and iOS. The previous CABO demo APK is a native prototype only; its local sample roles do not imply backend or web-route parity.

