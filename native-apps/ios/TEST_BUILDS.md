# iOS internal test build

The GitHub Actions workflow `.github/workflows/native-ios-verify.yml` compiles the SwiftUI app for the iOS Simulator when iOS source or the workflow changes.

## Download

1. Open the pull request's **Checks** tab and select **CABO native iOS build verification**.
2. Confirm the run is green and its commit matches the source you are testing.
3. Download artifact `CABO-iOS-Simulator-DEBUG-test-only` and extract the app bundle.

The workflow retains this artifact for two days. Rerun the workflow from GitHub Actions when a fresh build is needed.

## Test limits

This is an unsigned simulator app bundle, not an IPA. It cannot be installed on a physical iPhone or iPad, distributed with TestFlight or submitted to the App Store. It does not verify physical-device authentication, Keychain behavior, permissions, notifications or platform review requirements.

Use simulator test accounts and synthetic learner records. Device testing and CABO-owned signing credentials are required before claiming an iOS release.
