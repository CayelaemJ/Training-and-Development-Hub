# CABO Learning Hub for Android

This is the native Kotlin and Jetpack Compose app. Open this folder as the project in Android Studio:

1. Choose **Open** and select `native-apps/android` from the repository.
2. Let Gradle sync finish. If prompted, use JDK 17 and install Android SDK Platform 35.
3. In **Device Manager**, create or start an Android emulator (API 23 or newer), then select the `app` run configuration and press **Run**.

The normal build opens secure browser-based sign-in and points to the configured CABO API. Demo mode and test-login controls are compiled out of this build.

The API origin is a build-time setting (`-PcaboApiOrigin=...`), not embedded in app screens. Render remains the current default/test host while the Cloudflare migration is in progress. Once the Cloudflare API endpoint is ready, build against its HTTPS origin; do not point native builds at the web UI or add a WebView wrapper.

## CABO role demo

The internal demo opens a locally simulated CABO workspace without a login or backend. Switch between the **Child**, **Teacher** and **Parent** roles from the preview bar; each role has its own Home, Learn, Progress and Help/Family/Support areas.

- Child: read two different sample lessons, complete practice activities, review progress and report previews, and send a sample help request.
- Teacher: open that same request, add a triage note, prepare topic-aware starter guidance, and reply. Switch back to Child to see the reply.
- Parent: review the explicitly synthetic progress preview, respond to a sample family invitation, and see that school verification is still required after acceptance.
- All demo changes are shared across role switches during the session, so the walkthrough follows a real flow instead of unrelated static screens.

Every record is fictional. Demo actions stay in memory on the device and never write to CABO. The interface follows CABO's existing CABO Solutions wordmark, product naming, warm-paper background and green/orange/gold web palette. The demo is enabled only when a non-pilot API origin is explicitly supplied at build time:

```sh
./gradlew :app:assembleDebug \
  -PcaboApiOrigin=https://cabo-learning-native-isolated-preview.onrender.com \
  -PcaboEnableDemoMode=true
```

For the Cloudflare deployment, replace the origin with the deployed Worker/API HTTPS hostname; keep the route and authentication contract unchanged.

The default build never exposes demo mode. This showcase covers the child, teacher and parent learning/support flows currently implemented in the native app; it does not claim feature parity with every administration and reporting page in the CABO web app.

The Android app is implemented with native Kotlin and Jetpack Compose screens. It does not embed or redirect to the web application. The current native prototype covers selected learner, parent and educator workflows only; it is not full feature parity. Track the remaining native work in [../FEATURE_PARITY.md](../FEATURE_PARITY.md).

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
