# Android internal demo and test build

The GitHub Actions workflow `.github/workflows/native-android-debug.yml` builds a debug APK when an Android app or workflow file changes.

## Download

1. Open the pull request's **Checks** tab and select **CABO native Android emulator tests and debug APK**.
2. Confirm the run is green and its commit matches the source you are testing.
3. Download artifact `CABO-native-Android-DEMO-DEBUG-test-only` and extract `cabo-native-android-demo-debug.apk`.

The workflow retains this artifact for three days. Rerun the workflow from GitHub Actions when a fresh build is needed.

## Test limits

This APK is signed with Android's generated debug key. It is not signed for Google Play and is not a production release. Its demo role switcher uses fictional records and local-only interactions; no account or backend is needed to explore it. The APK also contains a separately gated isolated test-login control, but the current Render preview may be setup-pending. Compose tests verify material upload and support-draft forms; they do not exercise live object-storage transfer, draft delivery against a real school account, push notifications, guardian authorization or physical devices.

Use only authorised test accounts and synthetic learner records. Record the tested device model, Android version, install result, sign-in result and any reproduction steps without capturing real learner data. OS support floors in `DEVICE_INCLUSION_MATRIX.md` are proposed until device testing confirms them.
