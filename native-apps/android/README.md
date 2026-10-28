# CABO Learning Hub for Android

This is the native Kotlin and Jetpack Compose app. Open this folder as the project in Android Studio:

1. Choose **Open** and select `native-apps/android` from the repository.
2. Let Gradle sync finish. If prompted, use JDK 17 and install Android SDK Platform 35.
3. In **Device Manager**, create or start an Android emulator (API 23 or newer), then select the `app` run configuration and press **Run**.

The normal build opens secure browser-based sign-in and points to the configured CABO API. Demo mode and test-login controls are compiled out of this build.

## Interactive demo

The internal demo build includes synthetic learner, educator and guardian accounts. It runs without a login or backend and supports these walkthroughs:

- Learner: open study material, complete a sample practice quiz, see a clearly labelled local score, and review synthetic progress.
- Educator: open a sample support request, mark it triaged, generate a non-AI guidance draft, edit it, and add a reply locally.
- Guardian: review a synthetic school-verified progress preview and accept or decline a sample invitation locally.
- Switch roles from the demo banner to follow the same sample request across learner and educator screens.

Every record is fictional. Demo actions stay on the device and never write to CABO. The demo is enabled only when a non-pilot API origin is explicitly supplied at build time:

```sh
./gradlew :app:assembleDebug \
  -PcaboApiOrigin=https://cabo-learning-native-isolated-preview.onrender.com \
  -PcaboEnableDemoMode=true
```

The default build never exposes demo mode.

## Run the isolated test build

To build the separate credential-based test login, use only synthetic test accounts and the isolated Render preview. From this folder:

```sh
./gradlew :app:assembleDebug \
  -PcaboApiOrigin=https://cabo-learning-native-isolated-preview.onrender.com \
  -PcaboEnableTestLogin=true
```

Enter test credentials in the app when prompted. Do not add credentials to Gradle files, source code, screenshots, or commits. The resulting debug APK is for testing only and is not signed for a store release.

The CI APK combines offline demo mode with the isolated test-login control, so the demo can be explored even when the preview backend is unavailable. See [TEST_BUILDS.md](TEST_BUILDS.md) for artifact and test-scope details.

## Authenticated material upload

After secure sign-in, learner accounts can add a supported document from the Android system file picker in **Learn → Add material from this device**. The upload accepts PDF, DOCX, PPTX, XLSX, TXT, Markdown, CSV, PNG, JPEG and WebP files up to 30 MB. CABO validates the file contents on the server before extracting text. AI reading is explicitly left off by the native client. This authenticated flow is not available in the offline demo, whose sample learning data stays local.

## Build and emulator tests

```sh
./gradlew :app:assembleDebug
./gradlew :app:connectedDebugAndroidTest
```

The standard debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`. CI runs the instrumentation suite on an API 23 emulator and covers secure sign-in, quiz rules, role switching, educator support replies and triage, guidance review, material upload, and the learner support-draft form. Learner drafts and enrolled subject choices are encrypted with Android Keystore-backed storage, bound to the active session, and cleared on logout. Sending is explicit; a failed attempt leaves the draft for retry. Live object-storage uploads, physical-device checks, signed store releases, full teacher parity, and production authentication remain separate work.
