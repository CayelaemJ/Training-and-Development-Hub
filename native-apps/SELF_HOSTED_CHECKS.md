# Native Android and iOS checks

The native pull-request checks support self-hosted machines. They use GitHub-hosted runners by default and switch to self-hosted runners when the repository variables below are configured.

## Required runner labels and tools

| Check | Required labels | Runner requirements |
| --- | --- | --- |
| Android emulator and APKs | `self-hosted`, `Linux`, `X64` | Linux x86_64; readable and writable `/dev/kvm`; Java 17; Android SDK/emulator support; outbound access to Gradle and Maven repositories |
| iOS Simulator build and tests | `self-hosted`, `macOS` | macOS with Xcode and an available iOS Simulator runtime; command line tools selected; Homebrew available if XcodeGen needs installation |

Set repository **Actions variables** to use your own runners:

- `CABO_ANDROID_RUNNER_LABELS` = `["self-hosted","Linux","X64"]`
- `CABO_IOS_RUNNER_LABELS` = `["self-hosted","macOS"]`

Leave either variable unset to use `ubuntu-latest` for Android or `macos-15` for iOS. GitHub's built-in labels are case-insensitive. The Android self-hosted job deliberately fails in under a minute when KVM is unavailable, rather than waiting for an emulator that cannot boot. The emulator itself has a five-minute boot limit.

## Run the checks

Push a change under `native-apps/android/**`, `native-apps/ios/**`, or either workflow file. The matching workflow uses the configured runner labels. Both workflows can also be started from **Actions → Run workflow**.

The Android workflow runs Compose instrumentation tests on the minimum supported Android API, then builds standard and isolated-demo debug APKs. The iOS workflow generates the Xcode project, builds for iOS Simulator without signing, runs XCTest, and uploads a Simulator app archive. These checks do not produce signed store releases or replace physical-device acceptance.

Self-hosted runners must be dedicated to this repository's trusted code. Do not register a workstation runner with personal credentials, production secrets, or access to unrelated repositories.
