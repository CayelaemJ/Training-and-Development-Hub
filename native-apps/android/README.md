# CABO Learning Hub for Android

This is the native Kotlin and Jetpack Compose app. Open this folder as the project in Android Studio:

1. Choose **Open** and select `native-apps/android` from the repository.
2. Let Gradle sync finish. If prompted, use JDK 17 and install Android SDK Platform 35.
3. In **Device Manager**, create or start an Android emulator (API 23 or newer), then select the `app` run configuration and press **Run**.

The first launch opens the secure sign-in screen. The normal build points to the CABO pilot service and uses the system browser for its configured OIDC sign-in. The isolated test-login control is compiled out of this build.

## Run the isolated test build

Use only synthetic test accounts and the isolated Render preview. From this folder:

```sh
./gradlew :app:assembleDebug \
  -PcaboApiOrigin=https://cabo-learning-native-isolated-preview.onrender.com \
  -PcaboEnableTestLogin=true
```

Enter test credentials in the app when prompted. Do not add credentials to Gradle files, source code, screenshots, or commits. The resulting debug APK is for testing only and is not signed for a store release.

The equivalent isolated APK is also available as a short-retention artifact from the **CABO native Android emulator tests and debug APK** GitHub Actions run. See [TEST_BUILDS.md](TEST_BUILDS.md) for artifact and test-scope details.

## Build and emulator tests

```sh
./gradlew :app:assembleDebug
./gradlew :app:connectedDebugAndroidTest
```

The standard debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`. The instrumentation suite runs on the minimum supported API 23 emulator in CI and covers the secure sign-in screen and core quiz interactions. Physical-device checks, signed store releases, and production authentication still require their separate release gates.
