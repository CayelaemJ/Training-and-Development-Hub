# Test results — 2026-11-22 session

Environment: Linux sandbox, Node **v22.23.5** (CI uses Node 24), no npm registry access, no pnpm, no Android SDK, no .NET, no Xcode. PostgreSQL **16.15** server binaries available locally.
Dependency workaround: only **esbuild 0.28.2** (exact match to the repo's pinned `esbuild`) was linked from a preinstalled tool directory into an ignored `node_modules/`. Locally available zod (3.25) and TypeScript (6.0.3) do **not** match the repo (zod 4.6.7, TypeScript ~5.9.3) and were deliberately not used.

## 1. API built-in test suite

Command (same as CI step 2 in `.github/workflows/verify.yml`):

```sh
node --test artifacts/api-server/src/tests/*.test.mjs
```

| Run | Tests | Pass | Fail | Failures caused by |
|---|---:|---:|---:|---|
| main `5a30e1c`, no packages | 201 | 184 | 17 | missing `esbuild` (14), `zod`, `typescript`, `@electric-sql/pglite` |
| main `5a30e1c`, esbuild linked | 233 | 229 | 4 | missing `zod` (learnerAiProfilePolicy), `typescript` (mlopsEvaluation), `@electric-sql/pglite` (notificationSyntheticDatabase), `@upstash/blob` (privateBlobPolicy) |
| branch `83fb70e`, esbuild linked | 247 | 242 | 5 | the same 4, plus new `organizationInvitationDatabase.test.mjs` (missing `@electric-sql/pglite`) |
| branch `2ed9974`, esbuild linked | 251 | 246 | 5 | the same 5 |

No failure was caused by an assertion. Every failing file was individually checked for its module-resolution error.

## 2. New tests for F-2026-11-22-01

```sh
node --test artifacts/api-server/src/tests/organizationInvitationPolicy.test.mjs \
            artifacts/api-server/src/tests/organizationInvitationContract.test.mjs
```

Result: **13/13 pass** (8 policy, 5 contract).

Negative control — main's unfixed `routes/organizations.ts` swapped in temporarily, contract test re-run: **4 of 5 fail** (the fifth covers the separately fixed academic/hierarchy files). The fixed file was restored and confirmed by diff.

### 2b. Learner-initiated request gates (F-2026-11-22-02)

```sh
node --test artifacts/api-server/src/tests/learnerInitiatedRequestPolicy.test.mjs
```

Result: **4/4 pass**. Negative control with main's `routes/institutionRecords.ts`: **2/4 fail** (gate presence; uniform response). The first version of this test passed against unfixed code because a missing gate made `indexOf` return −1; it was corrected to assert the gate is present before comparing positions.

## 3. Migration on real PostgreSQL 16

```sh
# throwaway local cluster (initdb -A trust, unix socket only, no TCP)
PGHOST=/tmp/pgsock PGUSER=pgtest bash scripts/qa/verify-organization-invitations-postgres.sh
```

Result: **14/14 pass** — applies and re-applies idempotently; pending default with future expiry; rejects uppercase/padded emails and `owner` role; one open invitation per org+email; other tenant independent; answered status requires `responded_at`; FK rejects unknown organization; accept flow creates exactly one membership in the inviting org; slot reopens after an answer; **two truly concurrent accept transactions serialize on the row lock with exactly one winner** (≈2 s wall time for two 1 s holds); org deletion cascades; rollback `DROP TABLE` succeeds.

The script refuses to run unless `PGHOST` is a local socket path or localhost and only creates/drops a database named `invcheck`.

## 4. Other checks

| Check | Command | Result |
|---|---|---|
| Secret scan (tracked files) | `node scripts/security/scan-secrets.mjs` | 0 issues, 689 files (main); 0 issues, 706 files (branch `2ed9974`) |
| Secret scanner self-test | `node --test scripts/security/scan-secrets.test.mjs` | 5/5 pass |
| Native demo script syntax | `bash -n scripts/render-native-test-start.sh`; `node --check` on 5 scripts | pass |
| Changed TS/TSX syntax | esbuild `transform` on 7 changed files | pass |
| Script tests (`scripts/test-*.mjs`) | `node scripts/test-learner-support.mjs` etc. | **not runnable**: require `express` from an installed workspace |

## 4b. Android release configuration (`d1e8ade`)

The signing/version logic at the top of `native-apps/android/app/build.gradle.kts` does not depend on the Android Gradle Plugin, so it was copied into a scratch project and run with local Gradle 8.14.3 (`--offline`):

| Case | Expected | Result |
|---|---|---|
| no signing variables | unsigned, version 1 / 0.1.0 | pass |
| all four variables | signing ready | pass |
| only `CABO_ANDROID_KEYSTORE_PATH` | build fails with "Set all of …" | pass |
| `-PcaboVersionCode=7 -PcaboVersionName=1.2.3-rc.1` | accepted | pass |
| `-PcaboVersionName=latest` | rejected | pass |
| `-PcaboVersionCode=0` | rejected | pass |

The `android { signingConfigs / buildTypes }` additions, `assembleRelease`, `bundleRelease` and the new workflow were **not run** (no Android SDK or Google Maven). The workflow YAML parses (PyYAML) and uses the same pinned action SHAs as `native-android-debug.yml`.

## 4c. Windows installer (`a0ef12e`, GitHub Actions run 45035333823, `windows-latest`)

All 16 steps succeeded (status read from the public Actions API): Release x64 msbuild; assembly scan (positive control found the production origin; `CABO_ISOLATED_TEST_ORIGIN` absent); Inno Setup compile; silent install (executable and HKCU uninstall key present); 15 s startup check (informational, result in the job summary); silent uninstall (files, uninstall key and synthetic local token removed); SHA-256 checksum. Artifact `CABO-Windows-installer-UNSIGNED`, 21,497,925 bytes. Signing steps skipped (no certificate secrets).

## 4d. Two-tenant integration suite (`scripts/test-organizations.mjs`, CI `verify` job)

Runs the real organizations router against PGlite with real session rows. 15/15 checks passed in GitHub Actions (job 137250791360, commit `4ffa2f8`): the F-01 attack chain yields identical responses and no membership or name disclosure; only the verified addressee can see or answer invitations; decline is final; invite role limits; accept creates exactly one membership; expired invitations renew; school A gets 403/404 on school B members, invitations, submissions, dashboard, overrides and revocation; overrides change effective scores without touching AI marks; learners see only their own results without assessor identity.

At `8a4a42b` the full `build` job is green: install, built-in tests, all five integration scripts, typecheck, production build, browser and mobile checks.

## 5. Not run (and why)

| Check | Reason |
|---|---|
| `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run build` | No registry access; no pnpm |
| Playwright browser and mobile checks | Depend on build and Chromium download |
| Android emulator tests / APK / AAB | No Android SDK or Google Maven access |
| Windows MSBuild | No Windows runner or .NET |
| iOS simulator build | No macOS |
| Gitleaks, Semgrep, Trivy, Snyk, ZAP | Not installed; no network |
| Staging end-to-end (Render/Neon) | No environment access requested or used |

These must run in CI on the pushed branch before the change is considered verified.
