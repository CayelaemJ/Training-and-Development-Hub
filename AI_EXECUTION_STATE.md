# CABO Learning Hub execution checkpoint

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
| Android | Kotlin/Jetpack Compose app exists; README describes phone/tablet layouts, PKCE sign-in, Keystore storage and learner/educator/guardian flows. Android debug CI workflow exists. | Real device/emulator and authentication integration checks, upload picker, offline drafts and signed AAB. No signed release artifact was verified in this audit. |
| iOS | SwiftUI app and XcodeGen project definition exist; README describes role layouts, Keychain, sign-in, reports and quiz work. iOS verification workflow exists. | Quiz implementation is marked uncompiled in the README; physical-device/auth/submission checks, signed IPA and TestFlight/App Store readiness remain. A successful simulator build is not an IPA. |
| Windows | C#/WinUI 3 client exists; README describes PKCE sign-in and DPAPI storage. | Compile/live-login verification, interactive learner/teacher/guardian workflows, MSIX packaging and install/upgrade/uninstall validation. |
| Flutter | No Flutter workspace or Dart client identified. | Decide whether a migration is still intended. If yes, define a small vertical slice with parity and release criteria before duplicating the full native feature set. |

Device floors documented in the repository are proposed and explicitly not hardware verified. Do not claim compatibility with every device without physical-device evidence.

## Active high-priority privacy work

Open draft PR #60 reports and patches a school-specific guardian verification gap in the native parent overview: learner names were previously exposed based on a verified guardian relationship and any active school enrollment, without requiring the latest verification for that guardian-school pair.

At audit time, PR #60 commit `4c33bb2c6eabd10144616dabdc19b9dae3c23f67` had successful CircleCI verify, Snyk security and Snyk license statuses. The PR description still requires isolated staging checks with synthetic child data, including revoked/unenrolled guardian scenarios and query-performance review. Those staging checks were **not performed in this audit**. Keep the PR draft and do not claim the access fix is release verified until the stated evidence is recorded.

Two other open draft security fixes are:
- PR #58: trusted-origin checks for cookie-authenticated learner-session mutations.
- PR #59: configured-host and redirect-path validation for learner OIDC callbacks.

Both showed successful CircleCI verify, Snyk security and Snyk license statuses at audit time. Review their documented staging gates before release.

Other open work includes PR #49 (native internal test bundles), PR #51 (CircleCI security scan suite), PR #44 (lifelong learning passport), and Dependabot updates #53–#57. CI success on a commit is not evidence of app-store signing, physical-device behavior, or production privacy verification.


## Current isolated-test environment check

Railway project `CABO Learner Hub - Isolated Test`, environment `testing`, is accessible. The API service points at repository branch `main`. Its latest deployment, from 2026-10-16, is **FAILED** at `PRE_DEPLOY_COMMAND`: the pre-deploy command timed out after 300 seconds. The build itself completed. The configured pre-deploy command runs `pnpm --filter @workspace/db run push` and then `create-test-readonly-role.mjs`; the logs do not identify which command stalled. The service has no live instance, so authenticated synthetic staging checks cannot run now.

Railway's environment inventory showed one API service and a 5 GB volume not mounted on a service; it did not show a PostgreSQL service. The repository's `docs/RAILWAY_TESTING.md` says PostgreSQL is provisioned inside that Railway project. Since the resolved `DATABASE_URL` was not inspected, its target is unknown; confirm the actual test database target and correct the documentation/configuration drift before deploying. Do not re-run schema push or change the service source until the timeout cause and database target are understood.

The next staging work is now: inspect the failed pre-deploy execution and safe test database target; repair the isolated environment without touching production or deleting existing test data; deploy the PR #60 branch only after verifying the deployment will use the isolated synthetic-data database; then run and record the guardian authorization scenarios. If account-level credentials or a database-target confirmation are unavailable, keep the environment blocked and continue independent static review and native CI work.

## Iteration log

### Iteration 1 — repository and platform audit

- Located the actual repository and verified PR #40 is merged.
- Reviewed root structure, native-apps README, device inclusion matrix, multiplatform/install documentation, active PR list and commit statuses.
- Confirmed no Flutter/Dart workspace is present.
- Recorded that native clients exist but their platform-specific release evidence is incomplete.
- No source changes, deployments, merges or production data changes were made during the audit.
- Tests/builds: not run; this audit used read-only GitHub repository data.
- Branch: `docs/native-platform-audit-checkpoint-20261026`.
- Next: finish review and the synthetic isolated-staging verification for PR #60; record evidence in its PR, then address the remaining high-priority auth PRs #58 and #59. Resume the Android, iOS and Windows release gates after privacy/auth blockers are handled.

## Resume instructions

1. Fetch current `main`, PR states and CI statuses; this checkpoint may be stale after the next merge.
2. Keep learner/guardian validation in an isolated environment using synthetic records only.
3. Complete and document the PR #60 staging scenarios before marking it ready.
4. Continue from the platform matrix above; do not infer native builds or installs from web/PWA checks.
5. If a Flutter migration is explicitly selected, inventory API parity and existing native feature parity first, then build and verify a small end-to-end role workflow on all target platforms before expanding scope.
