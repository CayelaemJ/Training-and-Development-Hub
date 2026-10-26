# CABO native application programme — implementation progress

**Status:** Android Compose, iOS SwiftUI and Windows WinUI 3 native clients are present. The Android debug APK, unsigned iOS Simulator app and Windows debug package all compiled successfully in CI for PR #66 on 2026-10-26. Android CI now also launches an API 23 emulator for native sign-in and quiz screen tests, and creates a short-lived isolated Render test-login APK for manual device checks. These are test builds, not signed store or production releases. Physical-device, live authentication on-device and release installation remain unverified.

These are standalone native interfaces, **not browser wrappers, PWAs or React WebViews**. The existing PR #40 web application stays available as a separate channel.

## Platform delivery

| Platform | Implemented in this branch | Still required |
| --- | --- | --- |
| Android — Kotlin / Jetpack Compose | CABO-branded responsive phone/tablet UI; OIDC login via system browser and one-time PKCE bridge; Android Keystore token encryption; learner materials/quizzes/journey/help requests; educator assigned courses and authorized ticket queues; parents accept/decline invitations with verified-child privacy restrictions; native logout | API 23 emulator UI checks in CI; physical-device acceptance; uploaded document picker; offline drafts; authenticated native sign-in on device; signed release AAB |
| iOS — Swift / SwiftUI | Adaptive iPhone/iPad SwiftUI parent/learner/educator screens; ASWebAuthenticationSession + PKCE; iOS Keychain bearer storage; live role data, assigned teaching subjects, restricted parent invite decisions, authorized support queues; native quiz fetching, answer selection, submission and grading feedback (compiled for iOS Simulator in CI); native sign-out; callback Info.plist and XcodeGen definition | iPhone/iPad physical tests, native sign-in and submission integration, upload picker, signed build and TestFlight/App Store review |
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
- The tests cover the default secure sign-in screen, hidden-by-default test credentials, quiz answer requirements, one-shot submission behavior, and uncertain-submission recovery controls.
- Each run creates a standard debug APK and a separate short-retention test APK pinned to the isolated Render preview. Neither build contains account credentials or release signing keys.
- The test-login APK is for the isolated dummy-data service only. Never redistribute it as a production app.

