# CABO Learning Hub — Multiplatform Architecture and Release Status

**Reviewed:** 23 November 2026 against repository `main`. **Status:** source and workflow definitions present; production/mobile-store acceptance not established.

CABO Learning Hub has four independently maintained client experiences using the same authenticated Express API and the PostgreSQL/Drizzle data model. **They are not all wrappers around a website.** An installable web PWA is offered in addition to native clients.

| Client | Repository path | Implementation | Verification boundary |
| --- | --- | --- | --- |
| Web/PWA | `artifacts/training-platform` | React/Vite, install manifest and service worker; mobile-responsive role portals | Browser sign-in, role navigation, protected data, accessibility, install flow |
| Android | `native-apps/android` | Kotlin / Jetpack Compose; learner, family, school and assessment flows | Unit/instrumentation, signed APK/AAB, device and Play distribution approvals |
| iOS | `native-apps/ios` | Swift / SwiftUI; learner, guardian, school and assessment flows | Swift/Xcode/device testing, session isolation, signing and distribution |
| Windows | `native-apps/windows` | C# / WinUI 3, shared native core, tests and installer source | Windows xUnit, signed installer, OS compatibility, clean install/upgrade tests |

**Do not call these feature-branch-only:** the source folders and native CI workflow definitions are now present in `main`. The existence of build and packaging scripts **does not establish tested, signed, released or store-published binaries**.

## Security, data ownership and synchronization

Native/web interfaces must not independently authorize a learner, guardian or school record. The API validates server-resolved identity, school membership, source provenance, current guardian verification, consent and relevant feature release gates. Sensitive web navigation and `/api` responses are not service-worker cached. Authenticated offline data synchronization is not assumed.

Account switching, sign-out, revoked credentials, expired sessions and late asynchronous responses must clear prior account-specific state. Review `native-apps/FEATURE_PARITY.md`, `docs/ARCHITECTURE.md`, `docs/PRIVACY_AND_CONSENT.md` and the individual test-build guides.

## Release matrix and checks

- `.github/workflows/native-android-debug.yml` and `native-android-release.yml`: Android development/release candidate checks.
- `.github/workflows/native-ios-verify.yml`: iOS verification.
- `.github/workflows/native-windows-verify.yml` and `windows-release.yml`: Windows verification and packaging.
- `scripts/verify-installable-app.mjs`: installable web application checks.
- **Still required:** independently observed CI run, repeatable builds, native install tests on supported versions, privacy/data safety review, app signing, real-device QA, accessible navigation and owner release approval.

No deployment, app-store upload or live-account validation was performed during this documentation update.
