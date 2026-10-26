# CABO Learning Hub execution checkpoint

## Current checkpoint — 26 October 2026

This section supersedes the older audit snapshots below.

**Main:** `8288001b838ac2931a8f4d10e4b305b016e69fcd`.

- PR #91 refreshed this checkpoint and merged after CircleCI, Snyk and license checks passed.
- PR #89 hardens cookie-backed mutation origin checks and OIDC callback/return-path validation. PR #88 closes mixed-case/trailing-slash privacy-gate bypasses and cross-jurisdiction transfer metadata bypasses. PR #90 adds school-scoped native guardian overview/report routes.
- PR #86 is merged. Its latest head `0bae5dddaec3819926965363c32c155287d5fe85` passed three API 23 emulator instrumentation tests (3/3; zero skipped or failed), standard and isolated debug APK builds, browser/mobile checks, CircleCI, Snyk, Semgrep, secret scan, typecheck and build. Artifacts from [workflow run 40330332713](https://github.com/CayelaemJ/Training-and-Development-Hub/actions/runs/40330332713) expire 29 October 2026.
- Render staging remains `cabo-learning-native-isolated-preview` at `https://cabo-learning-native-isolated-preview.onrender.com`, attached to `feat/real-native-cabo-apps`, auto-deploy disabled. Its isolated test-login and synthetic-demo setup passed the authenticated API smoke check. No production service or database was changed.
- The original passport PR #44 was replaced by draft PR #92, rebased onto this main. GitHub Actions, CircleCI, Snyk and license checks pass, including passport HTTP/PGlite integration, typecheck, build, and browser/mobile checks. No migration or deployment was performed. The existing Neon validation branch contains the tables, but has no migration-journal rows for the two versioned Passport migrations; checksum-runner and staged API validation remain outstanding.
- PRs #68, #72 and #75 were closed as superseded: their fail-closed school release middleware/policy, scoped learner/report routes, attendance route, tests and docs are already present on main. The country pilot remains off; school, counsel, residency, backup/restore and end-to-end evidence are still required.
- The current Android path is the GitHub-hosted emulator. No local ADB/Ansight device is available, so physical-device acceptance remains outstanding.

**Remaining release gates:** PR #92 still needs isolated staged migration and authenticated API validation, backup/restore rehearsal, and consent/accessibility review before its code phase can be merged. Career applications remain gated pending employer verification and child-protection controls. Psychometric assessment requires a licensed instrument and professional governance. Android/iOS/Windows signed releases, physical-device flows, independent penetration testing, privacy/legal sign-off and production rollout remain incomplete. Do not claim national or store-release readiness.


**Updated:** 2026-10-26  
**Repository:** `CayelaemJ/Training-and-Development-Hub`  
**Default branch at audit:** `main` at `7536d3b105200f759957326878d810392e927921`  
**Status:** IN_PROGRESS — platform releases and privacy verification remain incomplete.

## Audit findings

The repository path in the earlier prompt was outdated. The accessible repository is `CayelaemJ/Training-and-Development-Hub`; `CABO-Solutions-ZA/Training-and-Development-Hub` returned 404.

The project is a TypeScript monorepo with a React/Vite web application, Express API and PostgreSQL/Drizzle data layer. The web install experience from PR #40 is merged. The repository contains separate native Android (Kotlin/Jetpack Compose), iOS (SwiftUI) and Windows (C#/WinUI 3) applications. **No Flutter project or Dart source was found in the repository root or native-apps tree.** Do not report Flutter delivery as started or complete.

The existing native clients are not browser wrappers. The native-apps README records some live role-scoped flows and describes other functions as incomplete or unverified. A full rewrite in Flutter would duplicate these clients and needs an explicit migration plan. For now, continue the existing platform clients and reuse their API contracts unless a scoped Flutter decision is made.

## Platform completion matrix

| Platform | Verified repository evidence | Remaining release work |
|---|---|---|
| Web | React/TypeScript app and merged PR #40 install page, manifest, icons, allowlisted public asset cache and offline reconnect page. PR #40 records hosted CI and live Render pilot checks. | Stable production origin, production cutover/data continuity and full web release gates remain separate from native distribution. |
| Android | Kotlin/Jetpack Compose app exists; README describes phone/tablet layouts, PKCE sign-in, Keystore storage and learner/educator/guardian flows. GitHub Actions compiled the debug APK on PR #66 commit `0cdf30ecf33ca84f286f58761f1f7fdf0d734f47`. Artifact `CABO-native-Android-DEBUG-test-only` (16 MB; artifact ID `12642527483`) expires 2026-10-29 10:20:59 UTC. | Real device/emulator and authentication integration checks, upload picker, offline drafts and signed AAB. This debug APK is not a release build. |
| iOS | SwiftUI app and XcodeGen project definition exist; README describes role layouts, Keychain, sign-in, reports and quiz work. GitHub Actions compiled the iOS Simulator app on PR #66 commit `0cdf30ecf33ca84f286f58761f1f7fdf0d734f47`. Artifact `CABO-iOS-Simulator-DEBUG-test-only` (1.1 MB; artifact ID `12643186034`) expires 2026-10-28 10:18:59 UTC. | Physical-device/auth/submission checks, signed IPA and TestFlight/App Store readiness remain. The unsigned simulator bundle is not an IPA. |
| Windows | C#/WinUI 3 client exists; README describes PKCE sign-in and DPAPI storage. GitHub Actions compiled the debug package on PR #66 commit `0cdf30ecf33ca84f286f58761f1f7fdf0d734f47`. Artifact `CABO-Windows-DEBUG-no-test-login` (34 MB; artifact ID `12643170791`) expires 2026-10-28 10:19:32 UTC. | Live-login verification, interactive learner/teacher/guardian workflows, MSIX packaging and install/upgrade/uninstall validation. The debug directory is not an installer. |
| Flutter | No Flutter workspace or Dart client identified. | Decide whether a migration is still intended. If yes, define a small vertical slice with parity and release criteria before duplicating the full native feature set. |

Device floors documented in the repository are proposed and explicitly not hardware verified. Do not claim compatibility with every device without physical-device evidence.

## Active high-priority privacy work

Open draft PR #60 reports and patches a school-specific guardian verification gap in the native parent overview: learner names were previously exposed based on a verified guardian relationship and any active school enrollment, without requiring the latest verification for that guardian-school pair.

At audit time, PR #60 commit `4c33bb2c6eabd10144616dabdc19b9dae3c23f67` had successful CircleCI verify, Snyk security and Snyk license statuses. The PR description still requires isolated staging checks with synthetic child data, including revoked/unenrolled guardian scenarios and query-performance review. Those staging checks were **not performed in this audit**. Keep the PR draft and do not claim the access fix is release verified until the stated evidence is recorded.

Two other open draft security fixes are:
- PR #58: trusted-origin checks for cookie-authenticated learner-session mutations.
- PR #59: configured-host and redirect-path validation for learner OIDC callbacks.

Both showed successful CircleCI verify, Snyk security and Snyk license statuses at audit time. Review their documented staging gates before release.

PR #49 (native internal test bundles) and PR #66 (artifact guides and accurate platform build status) are merged. PR #66's matching commit passed Android, iOS Simulator, Windows, repository verification, code safety, CircleCI verify, Snyk security and Snyk license checks. Its three exact-commit test artifacts are listed in the platform matrix above. PR #51 (CircleCI security scan suite) remains open: CircleCI `verify` and Snyk checks passed, while `security_suite` failed on build #301. The CircleCI log interface is not available in this workspace, so the failing scan and remediation are not yet verified. PR #44 (lifelong learning passport) and Dependabot updates #53–#57 also remain open. CI success on a commit is not evidence of app-store signing, physical-device behavior, or production privacy verification.


## Current Render isolated-test environment check

The intended staging platform is Render. The connected Render workspace has one dedicated service for native tests: `cabo-learning-native-isolated-preview` (`srv-dbdkf86q1p3s738u67e0`), attached to repository branch `feat/real-native-cabo-apps`. Its latest deployment is live at [cabo-learning-native-isolated-preview.onrender.com](https://cabo-learning-native-isolated-preview.onrender.com), using deploy `dep-dbdkkulg1s2s73br2rm0` and commit `7eea587419a1097496bdba140ddf303eb2a377b7`.

This service is intentionally unconfigured. Its startup log says “CABO isolated native demo is not connected. Serving setup-pending page” and “application APIs disabled.” The source serves a setup page at `/` and returns HTTP 503 for application API routes until test-only database configuration is present. This is a deliberate safe state, not a failed deployment.

The Render workspace has no Render Postgres instances. A matching Neon project, `cabo-learning-native-demo-isolated` (`lively-dream-83982597`), exists in the AWS EU Central region. Its ready `main` branch contains the `neondb` database; read-only table inventory returned no tables. This is the isolated candidate database named in the native-test setup work. Do not substitute the separate `cabo-learning-hub-pilot` Render service or any production/pilot database.

The Render startup guard requires `CABO_ENVIRONMENT=testing`, `CABO_TEST_DATABASE_ISOLATED=true`, `CABO_NATIVE_TEST_BOOTSTRAP=true`, `CABO_TEST_DATABASE_MARKER` (10–80 lowercase letters, numbers or hyphens) and `DATABASE_URL`. On a verified empty database, the test-only startup script pushes the schema, applies four reviewed migrations and writes the test marker. It refuses an unmarked nonempty database or a mismatched marker.

No database connection string was retrieved or sent to Render, no testing flags were set, and no schema command or deployment was run. The isolated Neon database is empty and available, but connecting it requires storing its connection credential in the Render native-preview service and authorizing guarded schema bootstrap. Once authorized, confirm the exact service and candidate database, set only the isolated test variables, then run synthetic guardian/auth scenarios. Keep the service setup-pending until those preconditions are approved.

An unrelated Railway environment was inspected before the user clarified Render is the platform in use. Its timeout is not the status of the CABO Render staging service and must not be used as a staging result.

## Iteration log

### Iteration 1 — repository and platform audit

- Located the actual repository and verified PR #40 is merged.
- Reviewed root structure, native-apps README, device inclusion matrix, multiplatform/install documentation, active PR list and commit statuses.
- Confirmed no Flutter/Dart workspace is present.
- Recorded that native clients exist but their platform-specific release evidence is incomplete.
- No production data changes were made. PR #49's CI workflow-only change was merged after its CircleCI, Snyk, iOS and Windows checks passed; no deployment or release signing was performed.
- Tests/builds: not run; this audit used read-only GitHub repository data.
- Branch: `docs/native-platform-audit-checkpoint-20261026`.
- Next: complete the guarded Render native-preview setup with the matching empty Neon test database only after connection/config approval; then verify PR #60 on synthetic records. Review PR #58 and #59 staging gates. PR #66's builds passed; the short-retention artifacts expired on 2026-10-28/29. PR #51's security scan failure still needs CircleCI logs. Resume signed Android/iOS/Windows release work after privacy/auth blockers are verified.

## Additional activity after the initial audit

- Merged PR #49 after checking CircleCI verify, Snyk, iOS simulator build and Windows build statuses. Its artifacts later expired.
- Initially inspected an unrelated Railway environment; after the user clarified Render is the intended platform, identified the dedicated Render native preview and matching empty Neon test database. The Render preview is live but deliberately setup-pending; no DB change was made.
- Static-read PR #60 patch and PR #58/#59 diffs; no staging or physical-device claims were made.
- Opened PR #66 with platform test-artifact guides to trigger fresh Android, iOS simulator and Windows CI builds. All three builds passed on commit `0cdf30ecf33ca84f286f58761f1f7fdf0d734f47`; Android, iOS Simulator and Windows test artifacts were generated with short retention.

## Resume instructions

1. Fetch current `main`, PR states and CI statuses; this checkpoint may be stale after the next merge.
2. Keep learner/guardian validation in an isolated environment using synthetic records only.
3. Complete and document the PR #60 staging scenarios before marking it ready.
4. Continue from the platform matrix above; do not infer native builds or installs from web/PWA checks.
5. If a Flutter migration is explicitly selected, inventory API parity and existing native feature parity first, then build and verify a small end-to-end role workflow on all target platforms before expanding scope.


## Latest follow-up evidence (2026-10-26)

- PR #66 merged as `d61c821a424a0322ce3c8201a3d0e7e312f819fe` after all checks passed; its source head was `0cdf30ecf33ca84f286f58761f1f7fdf0d734f47`.
- Render's dedicated native-preview service is live but deliberately setup-pending and disables API routes. Its startup log confirms the test DB is not connected. The matching Neon project/branch/database exists and its table inventory is empty. No connection URL was retrieved or sent, no bootstrap flags were enabled and no deployment or DB command was run; approval is still needed before storing the credential in Render and starting guarded schema setup.
- PR #58/#59/#60 remain draft pending isolated staging and identity/configuration checks. PR #51 remains blocked by the unexplained CircleCI `security_suite` failure on build #301.
