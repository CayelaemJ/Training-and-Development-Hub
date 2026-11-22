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

No failure was caused by an assertion. Every failing file was individually checked for its module-resolution error.

## 2. New tests for F-2026-11-22-01

```sh
node --test artifacts/api-server/src/tests/organizationInvitationPolicy.test.mjs \
            artifacts/api-server/src/tests/organizationInvitationContract.test.mjs
```

Result: **13/13 pass** (8 policy, 5 contract).

Negative control — main's unfixed `routes/organizations.ts` swapped in temporarily, contract test re-run: **4 of 5 fail** (the fifth covers the separately fixed academic/hierarchy files). The fixed file was restored and confirmed by diff.

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
| Secret scan (tracked files) | `node scripts/security/scan-secrets.mjs` | 0 issues, 689 files (main); 0 issues, 696 files (branch, before docs commit) |
| Secret scanner self-test | `node --test scripts/security/scan-secrets.test.mjs` | 5/5 pass |
| Native demo script syntax | `bash -n scripts/render-native-test-start.sh`; `node --check` on 5 scripts | pass |
| Changed TS/TSX syntax | esbuild `transform` on 7 changed files | pass |
| Script tests (`scripts/test-*.mjs`) | `node scripts/test-learner-support.mjs` etc. | **not runnable**: require `express` from an installed workspace |

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
