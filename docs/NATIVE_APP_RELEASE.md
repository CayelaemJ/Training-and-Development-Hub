# CABO Learning Hub — Android, iPhone/iPad, Windows and web releases

**Status (22 October 2026): pilot packaging source added, not a signed store release.**
Base: [PR #40](https://github.com/CayelaemJ/Training-and-Development-Hub/pull/40) (merged). This follow-up adds candidate source/tooling for native distributions on a separate branch; it does **not** mean an APK/AAB/IPA/EXE has been compiled, device-tested, signed or published.

## One learning system, four entry points

| Platform | Current usable option | Candidate native distribution | Build source |
| --- | --- | --- | --- |
| Web | Existing hosted CABO React/PWA | Browser | `artifacts/training-platform` |
| Android | Browser installation from `/install` | Trusted Web Activity, APK (direct testing) / AAB (Play Store) | `native/android/README.md` |
| iPhone/iPad | Safari > Add to Home Screen | SwiftUI + WKWebView iOS app for Xcode/TestFlight, **not Store-approved** | `native/ios` |
| Windows | Edge/Chrome install from `/install` | Electron NSIS `.exe` setup candidate | `native/desktop` |
| macOS / Linux / Chromebook | Browser/PWA | Linux AppImage candidate; macOS PWA until native signing solution is delivered | `native/desktop` |

All editions use the *same HTTPS site and server*. No embedded API keys, separate account tables, duplicated learner data, or unreviewed offline write queues. The app requires connectivity for learner data, marking, uploads and submissions. Browser/service-worker caches are already restricted in PR #40.

## Critical production domain decision

The only verified installable destination from PR #40 is the **isolated Render pilot**: `https://cabo-learning-hub-pilot.onrender.com/install`. Native Windows and iOS candidate code deliberately references that pilot **only for development**. Change their configured URL to a stable, CABO-controlled production domain before public release, and rebuild apps, Android TWA verification, app-origin policies, and store metadata accordingly. Do not confuse the Render pilot with the eventual live learning environment or publish institutions' data against that pilot.

## Android

Follow `native/android/README.md`. Use Bubblewrap to generate an Android project and signed developer APK/AAB. Deploy a valid `/.well-known/assetlinks.json` on the production origin with the **real fingerprint of the signing certificate**. Verify fullscreen TWA origin association. Keep keystore/Play signing credentials outside source control. Android release signing and Play Store registration are separate prerequisites.

## Windows

From Windows PowerShell with Node.js 24+:

```powershell
cd native/desktop
npm install
npm test
npm run build:win
# Inspect native/desktop/dist for CABO-Learning-Hub-Setup-*.exe
```

The desktop application blocks arbitrary remote navigation, disables Node.js integration, sandboxes web content, denies OS privileges by default and retains the same server-side session/login flow. It does not make CABO offline-first. It is a *remote* trusted-origin wrapper, not a second frontend build. Authentication via external OIDC redirects and download/upload workflows need on-device tests, especially where the provider opens popups. The app requires a production code-signing certificate and Windows SmartScreen reputation for broad distribution. The optional `workflow_dispatch` Windows workflow creates an **unsigned pilot artifact** when GitHub runner billing/credits permit; it never runs automatically.

## iOS

Follow `native/ios/README.md` on a Mac with Xcode and XcodeGen. Generate the CABO brand icon using the shared icon script. Update the source URL and bundle/team IDs, archive, sign, and invite testers through TestFlight if CABO has an Apple Developer account. Completing Xcode generation is **not** App Store approval. Apple's Guideline 4.2 requires useful native app functionality beyond a repackaged webpage, so the candidate native shell is intentionally blocked from publication until that gap and authentication have been addressed.

## Minimum end-to-end release gates

1. Select permanent HTTPS CABO production domain and confirm the data, backups, production authentication and all role permissions are valid. Freeze application IDs and branding.
2. Build candidate artifacts on native toolchains, record exact tool versions, artifact SHA-256 hashes, signing identity and release commit. Do not place signing keys or secrets in GitHub logs.
3. Test Android (physical + emulator), iOS (physical iPhone/iPad), Windows 10/11, and web at multiple sizes. Verify native login/logout, OAuth provider navigation, expired sessions, file uploads and PDF/DOCX imports, content download, quiz creation/marking, retry after lost connectivity, screen-reader accessibility, rotations, mobile keyboard, deep links, and back navigation.
4. Validate learner/staff/guardian tenant isolation, child-privacy disclosures, data retention, guardian consent, direct uploads, API rate limits and the privacy/security testing gates from the main CABO release. Never collect/record real children's data in test videos or logs.
5. Check that both app and browser reflect the same learner state across devices. Confirm interrupted submissions do not silently replay/double-mark.
6. Finish privacy policies, screenshots, age/category disclosures, app-support URL, permissions justification, Google Play Data Safety and Apple's App Privacy / Kids category requirements as applicable.
7. Release behind limited school-pilot invites, monitor crash/error telemetry without collecting personal learner content, then expand only after satisfactory results. Establish signed update/rollback plans for each native package.

## Why not a one-command cross-platform export?

Native packaging introduces distinct operating-system trust, authentication and store review gates. Android's TWA uses the working PWA with Digital Asset Links; Windows requires an executable and code signing; iOS requires an Apple build/signing environment and meaningful native UX. Saying “available in the App Store” or handing out fake “installer” links before these gates would mislead schools.

Technical references:
- https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2
- https://www.electronjs.org/docs/latest/tutorial/security/
- https://developer.apple.com/app-store/review/guidelines/
