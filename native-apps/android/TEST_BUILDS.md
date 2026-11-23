# Android internal demo and test build

The GitHub Actions workflow `.github/workflows/native-android-debug.yml` builds a debug APK when an Android app or workflow file changes.

## Download

1. Open the pull request's **Checks** tab and select **CABO native Android emulator tests and debug APK**.
2. Confirm the run is green and its commit matches the source you are testing.
3. Download artifact `CABO-native-Android-DEMO-DEBUG-test-only` and extract `cabo-native-android-demo-debug.apk`.

The workflow retains this artifact for three days. Rerun the workflow from GitHub Actions when a fresh build is needed.

## Test limits

This APK is signed with Android's generated debug key. It is not signed for Google Play and is not a production release. Its demo role switcher uses fictional records and local-only interactions; no account or backend is needed to explore it. The APK also contains a separately gated isolated test-login control, but the Render preview may require setup. Compose tests cover learning, practice, sample support handoff, parent invitation/report views, material upload and support drafts; they do not exercise live object-storage transfer, draft delivery against a real school account, push notifications, guardian authorization or physical devices. The demo represents the native child, teacher and parent flows and does not include every feature available in the web application.

Use only authorised test accounts and synthetic learner records. Record the tested device model, Android version, install result, sign-in result and any reproduction steps without capturing real learner data. OS support floors in `DEVICE_INCLUSION_MATRIX.md` are proposed until device testing confirms them.

## Release candidates (APK + AAB)

Workflow **CABO native Android release candidate (manual)** (`.github/workflows/native-android-release.yml`) builds the `release` build type with `assembleRelease` and `bundleRelease`. It runs only when started by hand with a version code and version name.

- **Release builds never include the isolated test login or offline demo mode.** The `release` build type sets both `BuildConfig` flags to `false` regardless of Gradle properties.
- **Signing comes only from repository secrets:** `CABO_ANDROID_KEYSTORE_BASE64` (base64 of the upload keystore), `CABO_ANDROID_KEYSTORE_PASSWORD`, `CABO_ANDROID_KEY_ALIAS`, `CABO_ANDROID_KEY_PASSWORD`. Set all four or none; a partial set fails the build. Never commit a keystore or passwords.
- With no secrets, the artifact is named `CABO-native-Android-RELEASE-UNSIGNED` and files end in `UNSIGNED-do-not-distribute`. These builds can't be installed as-is or uploaded to Play.
- Locally: `./gradlew :app:bundleRelease -PcaboVersionCode=2 -PcaboVersionName=0.2.0` (with the four `CABO_ANDROID_*` environment variables for a signed build; `CABO_ANDROID_KEYSTORE_PATH` points to the keystore file).
- R8 minification is off until keep rules are tested on devices.

A signed artifact is still only a **candidate**: physical-device acceptance, Play data-safety declarations, store listing and owner approval are required before any distribution. Status 2026-11-22: configuration added; the release build has **not yet been run** in CI or on a device.
