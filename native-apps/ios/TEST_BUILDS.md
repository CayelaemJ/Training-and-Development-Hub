# iOS internal test build

The GitHub Actions workflow `.github/workflows/native-ios-verify.yml` compiles the SwiftUI app for the iOS Simulator and runs the native unit tests (progression review, tutor response contract and account-state isolation) when iOS source or the workflow changes.

## Download

1. Open the pull request's **Checks** tab and select **CABO native iOS build verification**.
2. Confirm the run is green and its commit matches the source you are testing.
3. Download artifact `CABO-iOS-Simulator-DEBUG-test-only` and extract the app bundle.

The workflow retains this artifact for two days. Rerun the workflow from GitHub Actions when a fresh build is needed.

The iOS API origin is supplied by the `CABO_API_ORIGIN` Xcode build setting, with Render remaining the current default. For a Cloudflare API build, override the setting with the deployed HTTPS Worker/API origin, for example `xcodebuild ... CABO_API_ORIGIN=https://<deployed-api-host>`; the hostname will be set once the migration endpoint is available.

## Test limits

This is an unsigned simulator app bundle, not an IPA. It cannot be installed on a physical iPhone or iPad, distributed with TestFlight or submitted to the App Store. Simulator tests do not verify physical-device authentication, Keychain behavior, permissions, notifications or platform review requirements.

Use simulator test accounts and synthetic learner records. Device testing and CABO-owned signing credentials are required before claiming an iOS release.

## TestFlight preparation still required

The project now contains an app icon, a privacy manifest and `ITSAppUsesNonExemptEncryption = NO`. A TestFlight upload still needs CABO's Apple Developer team, a distribution certificate and provisioning profile stored as repository secrets, an archive/export step, an App Store Connect record for `za.co.cabosolutions.learninghub`, and confirmed App Store privacy answers. None of these are committed or configured here.
