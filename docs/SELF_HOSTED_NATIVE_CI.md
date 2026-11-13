# CABO native CI

The source lives in `native-apps/android` (Kotlin/Compose) and `native-apps/ios` (SwiftUI/XcodeGen). Android CI uses the project's self-hosted Linux runner in WSL. iOS CI uses a standard GitHub-hosted macOS runner because Xcode requires macOS and the project repository is public. Standard GitHub-hosted runners are free for public repositories; recheck billing if repository visibility changes.

A green check means only the commands below passed, **not** that device sign-in, App Store release, or production readiness was verified.

## Android self-hosted runner

Use a dedicated GitHub Actions self-hosted **Linux** runner with default labels `self-hosted`, `Linux`; JDK 17 (`JAVA_HOME`), Android SDK platform 35 + build-tools 35.0.0 (`ANDROID_HOME`), and Gradle 8.11.1 available on PATH. Prefer a committed, verified Gradle wrapper; the current project has no wrapper.

Register the runner under repository **Settings > Actions > Runners**. On Windows + WSL, launch the Linux runner inside WSL, not a Windows runner advertised as Linux. Keep production secrets off build runners. Configure the runner as a non-root account, use a disposable build workspace where possible, and do not run untrusted fork PR code on a persistent self-hosted runner.

## Required checks

`CABO Android native verification (self-hosted) / android-verify`: environment preflight, Android lint, JUnit unit tests with a nonzero-discovery assertion, debug APK compilation, APK assertion, and report artifacts.

`CABO iOS native verification (GitHub-hosted macOS) / ios-verify`: macOS/Xcode preflight, XcodeGen installation, project generation, unsigned simulator compilation, Xcode static analysis, simulator app/binary assertion, and build artifact upload.

Android currently has six JUnit cases for quiz submission policy. They are unit tests of local validation logic, not API integration or device E2E tests. The iOS project currently has no XCTest target: its check is **compile + analyzer**, not an XCTest pass. Add broader Android API/UI tests and iOS XCTest/simulator E2E before claiming full runtime validation.

The workflows are path-filtered, so their checks appear only on PRs that modify the relevant native files or workflow. If branch protection requires these names on every PR, remove the path filters or use an unfiltered aggregate job.

## Test locally

Android from repository root:
```bash
cd native-apps/android
gradle :app:lintDebug :app:testDebugUnitTest :app:assembleDebug --no-daemon --stacktrace
test -s app/build/outputs/apk/debug/app-debug.apk
```

iOS on a Mac:
```bash
cd native-apps/ios
xcodegen generate
xcodebuild -project CABOLearningHub.xcodeproj -scheme CABOLearningHub -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build analyze
```

## Failure handling

A queued Android job means no matching **online** self-hosted runner. A red job must be fixed at the source. Do not use `continue-on-error`, `|| true`, or mock artifacts to force green. Debug APKs and unsigned simulator apps are testing artifacts only, not distributable signed releases.
