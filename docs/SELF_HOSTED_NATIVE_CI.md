# CABO self-hosted native CI

The source lives in `native-apps/android` (Kotlin/Compose) and `native-apps/ios` (SwiftUI/XcodeGen). GitHub-hosted builds are replaced by separate self-hosted runner jobs. A green check means only the commands below passed, **not** that device sign-in, App Store release, or production readiness was verified.

## Register runners

- Android: dedicated GitHub Actions self-hosted **Linux** runner with default labels `self-hosted`, `Linux`; JDK 17 (`JAVA_HOME`), Android SDK platform 35 + build-tools 35.0.0 (`ANDROID_HOME`), and Gradle 8.11.1 available on PATH. Prefer a committed, verified Gradle wrapper; the current project has no wrapper.
- iOS: dedicated GitHub Actions self-hosted **macOS** runner with default labels `self-hosted`, `macOS`; supported full Xcode, Simulator SDK, Xcode command line tools, and XcodeGen installed. A Linux/Windows machine cannot compile an iOS app with Xcode.
- Register each under repository **Settings > Actions > Runners** or an authorized organization runner group. Do not add production secrets to PR build workflows.
- On Windows + WSL, launch a **Linux** GitHub runner *inside WSL* for Android, not a Windows runner advertised as Linux. Configure each runner as an isolated, non-root service account. Use disposable build workspace where possible. Treat PR code as untrusted on persistent machines.

## Required checks

`CABO Android native verification (self-hosted) / android-verify`: environment preflight, Gradle Android lint, Gradle unit-test task, debug APK compilation, nonempty APK assertion, report artifacts.

`CABO iOS native verification (self-hosted macOS) / ios-verify`: Xcode/XcodeGen preflight, project generation, unsigned simulator compilation, Xcode static analysis, simulator app/binary assertion.

Android unit-test task may currently discover zero tests; create actual Android instrumented/unit tests and require nonzero test discovery in a follow-on change. iOS project currently has no XCTest target: its check is **compile + analyzer**, not an XCTest test pass. Add XCTest and simulator/device E2E testing before claiming runtime validation.

Open branch protection rules on the relevant **target branch** and require the exact status checks once they have appeared in Actions. Require both Android and iOS checks before merging native changes, and protect the native apps from changes that bypass their checks. **Path filters mean neither check appears on unrelated PRs**; if branch protection requires them for every PR, remove both `pull_request.paths` filters first to avoid permanently pending required checks.

## Test locally

Android from repository root:
```bash
cd native-apps/android
gradle :app:lintDebug :app:testDebugUnitTest :app:assembleDebug --no-daemon --stacktrace
test -s app/build/outputs/apk/debug/app-debug.apk
```

iOS on macOS:
```bash
cd native-apps/ios
xcodegen generate
xcodebuild -project CABOLearningHub.xcodeproj -scheme CABOLearningHub -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build analyze
```

## Failure handling

A queued job means no matching **online** self-hosted runner, not a passing test. A red job must be fixed at the source. Do not use `continue-on-error`, `|| true`, or mock artifacts to force green. Debug APKs and unsigned simulator apps are testing artifacts only, not distributable signed releases.
