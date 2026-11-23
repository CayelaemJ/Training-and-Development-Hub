# Android internal demo and test build

The [Android build workflow](../../.github/workflows/native-android-debug.yml) checks the demo APK on an Android emulator before uploading it.

## Download and install

1. Open the [Android workflow](https://github.com/CayelaemJ/Training-and-Development-Hub/actions/workflows/native-android-debug.yml) and select a successful run for your branch.
2. Open **Artifacts**, download **CABO-Android-Demo-APK**, and extract `cabo-learning-hub-demo.apk` from the ZIP.
3. Open the extracted APK on an Android 6.0 or newer device and allow installation from that source if prompted.
4. Launch **CABO Learning Hub Demo** from the app drawer. It opens the sample learner workspace with Child, Teacher and Parent role switching.

The demo has its own application ID and can be installed alongside the connected CABO app. If Android reports a conflicting signature from an older **CABO Learning Hub Demo** build, uninstall that demo app and install the new APK. The artifact is retained for 14 days.

## Test limits

The demo uses a generated debug key and fictional records. It opens offline and has no Internet permission. CI checks that the APK declares its icon, installs, launches, and shows the role switcher on API 23. Physical-device acceptance remains a separate check. Record device model, Android version, and any reproduction steps with synthetic data only.

## Release candidates (APK + AAB)

Workflow **CABO native Android release candidate (manual)** (`.github/workflows/native-android-release.yml`) builds the `release` build type with `assembleRelease` and `bundleRelease`. It runs only when started by hand with a version code and version name.

- **Release builds never include the isolated test login or offline demo mode.** The `release` build type sets both `BuildConfig` flags to `false` regardless of Gradle properties.
- **Signing comes only from repository secrets:** `CABO_ANDROID_KEYSTORE_BASE64` (base64 of the upload keystore), `CABO_ANDROID_KEYSTORE_PASSWORD`, `CABO_ANDROID_KEY_ALIAS`, `CABO_ANDROID_KEY_PASSWORD`. Set all four or none; a partial set fails the build. Never commit a keystore or passwords.
- With no secrets, the artifact is named `CABO-native-Android-RELEASE-UNSIGNED` and files end in `UNSIGNED-do-not-distribute`. These builds can't be installed as-is or uploaded to Play.
- Locally: `./gradlew :app:bundleRelease -PcaboVersionCode=2 -PcaboVersionName=0.2.0` (with the four `CABO_ANDROID_*` environment variables for a signed build; `CABO_ANDROID_KEYSTORE_PATH` points to the keystore file).
- R8 minification is off until keep rules are tested on devices.

A signed artifact is still only a **candidate**: physical-device acceptance, Play data-safety declarations, store listing and owner approval are required before any distribution. Status 2026-11-22: configuration added; the release build has **not yet been run** in CI or on a device.
