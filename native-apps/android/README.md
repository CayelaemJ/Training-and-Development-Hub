# CABO Learning Hub for Android

This is the native Kotlin and Jetpack Compose app. Open this folder as the project in Android Studio:

1. Choose **Open** and select `native-apps/android` from the repository.
2. Let Gradle sync finish. If prompted, use JDK 17 and install Android SDK Platform 35.
3. In **Device Manager**, create or start an Android emulator (API 23 or newer), then select the `app` run configuration and press **Run**.

The normal build opens secure browser-based sign-in and points to the configured CABO API. Demo mode and test-login controls are compiled out of this build.

Signed-in learners can open the private Learner Passport from **Progress**. It loads only on request from the authenticated learner-passport API and offers an explicit JSON share action. When the server feature is disabled or unavailable, the app shows a retryable message. Synthetic demo records are never exported.

The API origin is a build-time setting (`-PcaboApiOrigin=...`), not embedded in app screens. Render remains the current default/test host while the Cloudflare migration is in progress. Once the Cloudflare API endpoint is ready, build against its HTTPS origin; do not point native builds at the web UI or add a WebView wrapper.

## CABO role demo

The internal demo opens a locally simulated CABO workspace without a login or backend. Switch between the **Child**, **Teacher** and **Parent** roles from the preview bar; each role has its own Home, Learn, Progress and Help/Family/Support areas.

- Child: read two different sample lessons, complete practice activities, review progress and report previews, check personal attendance, see school notices and browse a published sample timetable, and send a sample help request.
- Teacher: open that same request, add a triage note, prepare topic-aware starter guidance, and reply. Switch back to Child to see the reply. Teacher preview also includes school notices, an assigned timetable, sample attributed questions and an assessment paper workflow.
- Parent: review the synthetic progress preview, respond to a sample family invitation, and manage an explicitly synthetic email preference that stays local to the device.
- All demo changes are shared across role switches during the session, so the walkthrough follows a real flow instead of unrelated static screens.

Every record is fictional. Demo actions stay in memory on the device and never write to CABO. The interface follows CABO's existing CABO Solutions wordmark, product naming, warm-paper background and green/orange/gold web palette. Build the standalone offline demo with:

```sh
./gradlew :app:assembleDemo
```

Open **CABO Learning Hub Demo** after installing `app/build/outputs/apk/demo/app-demo.apk`. Its separate package can coexist with the connected app. This showcase covers the child, teacher and parent learning/support flows currently implemented in the native app; it does not claim feature parity with every administration and reporting page in the CABO web app.

The Android app is implemented with native Kotlin and Jetpack Compose screens. It does not embed or redirect to the web application. The current native prototype covers selected learner, parent and educator workflows only; it is not full feature parity. Track the remaining native work in [../FEATURE_PARITY.md](../FEATURE_PARITY.md).

## Run the isolated test build

To build the separate credential-based test login, use only synthetic test accounts and the isolated Render preview. From this folder:

```sh
./gradlew :app:assembleDebug \
  -PcaboApiOrigin=https://cabo-learning-native-isolated-preview.onrender.com \
  -PcaboEnableTestLogin=true
```

Enter test credentials in the app when prompted. Do not add credentials to Gradle files, source code, screenshots, or commits. The resulting debug APK is for testing only and is not signed for a store release.

The CI demo APK opens the sample workspace without a network connection or test credentials. See [TEST_BUILDS.md](TEST_BUILDS.md) for download and installation details.

## Authenticated material upload

After secure sign-in, learner accounts can add a supported document from the Android system file picker in **Learn → Add material from this device**. The upload accepts PDF, DOCX, PPTX, XLSX, TXT, Markdown, CSV, PNG, JPEG and WebP files up to 30 MB. CABO validates the file contents on the server before extracting text. AI reading is explicitly left off by the native client. This authenticated flow is not available in the offline demo, whose sample learning data stays local.

## Build and emulator tests

```sh
./gradlew :app:assembleDebug
./gradlew :app:connectedDebugAndroidTest
```

The standard debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`. CI runs the instrumentation suite on an API 23 emulator and covers secure sign-in, quiz rules, role switching, educator support replies and triage, guidance review, material upload, the learner support-draft form, school-operations and assessment-workspace demo navigation, written exam answer validation and marking feedback, owner/admin assignment creation and mark review, and explicit notification-consent confirmation and revocation. Learner drafts and enrolled subject choices are encrypted with Android Keystore-backed storage, bound to the active session, and cleared on logout. Sending is explicit; a failed attempt leaves the draft for retry. Live object-storage uploads, physical-device checks, signed store releases, full teacher parity, and production authentication remain separate work.

## Study tutor (AI)

Learners with study materials can open **Learn → Study tutor** and ask questions about one of their own materials. The app calls the existing `POST /api/materials/{id}/ask` route; the server runs the configured AI provider (Groq by default), checks material ownership, treats the question as untrusted input and only returns answers whose quoted citations come from that material. The app never holds an AI provider key. Questions are bounded to 5–2,000 characters, the conversation is kept in memory only and cleared when the screen closes, and errors show fixed learner-friendly messages rather than server text.

A short safeguarding phrase list catches questions that suggest a learner may be unsafe. Those questions are **not** sent to the AI; the learner is pointed to a trusted adult, Childline (116 in South Africa) and the in-app teacher support request. This is a safety net, not a classifier, and does not replace school safeguarding procedures.

## Sports and development plans

**Learn → Plan sports & activity practice** drafts a short practice plan for sport, academic, creative, leadership or other activities from what the learner types. It uses the existing `POST /api/development-plans/draft` route: the server runs Groq or, if the AI is unavailable, a deterministic starter template, and always returns an unverified draft. The app labels which one it is, keeps the plan in memory only and states that a coach, teacher or guardian must review it. This is planning support, not a sports achievement record; the backend has no achievements store yet.

## Release builds

```sh
./gradlew :app:testDebugUnitTest      # JVM unit tests
./gradlew :app:lintRelease            # static analysis
./gradlew :app:assembleRelease :app:bundleRelease -PcaboVersionCode=2 -PcaboVersionName=0.2.0
```

Release builds enable R8 code and resource shrinking and strip verbose/debug/info logging. Signing is read only from the build machine's environment: `CABO_ANDROID_KEYSTORE_PATH`, `CABO_ANDROID_KEYSTORE_PASSWORD`, `CABO_ANDROID_KEY_ALIAS` and `CABO_ANDROID_KEY_PASSWORD`. Without all four, `app-release-unsigned.apk` and an unsigned `app-release.aab` are produced and must be signed before distribution. In GitHub Actions, the `android-release` job reads these from repository secrets (`CABO_ANDROID_KEYSTORE_BASE64` plus the three passwords/alias) and uploads the APK and AAB as a 7-day artifact. Nothing is published to Google Play automatically.
