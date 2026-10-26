# Android internal test build

The GitHub Actions workflow `.github/workflows/native-android-debug.yml` builds a debug APK when an Android app or workflow file changes.

## Download

1. Open the pull request's **Checks** tab and select **CABO native Android debug APK (manual)**.
2. Confirm the run is green and its commit matches the source you are testing.
3. Download artifact `CABO-native-Android-DEBUG-test-only` and extract `app-debug.apk`.

The workflow retains this artifact for three days. Rerun the workflow from GitHub Actions when a fresh build is needed.

## Test limits

This is an installable debug APK signed with Android's generated debug key. It is not signed for Google Play and is not a production release. Do not distribute it as a school rollout. The build alone does not verify login, API connectivity, uploads, push notifications, guardian authorization or behavior on physical devices.

Use only authorised test accounts and synthetic learner records. Record the tested device model, Android version, install result, sign-in result and any reproduction steps without capturing real learner data. OS support floors in `DEVICE_INCLUSION_MATRIX.md` are proposed until device testing confirms them.
