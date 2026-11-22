# Production completion audit

**Date:** 2026-11-22 · **Auditor:** Claude (implementation) · **Independent reviewer:** pending (ChatGPT) · **Owner approval:** not given
**Baseline:** `main` at `5a30e1c9bbcf44d9e2f3d8c17f41b9109316061f` (2026-11-21) · **Working branch:** `fix/org-member-consent-invitations-20261122`
**Supersedes for this session:** `docs/engineering/COMPLETION_AUDIT.md` (2026-11-14 baseline). `AI_EXECUTION_STATE.md` (2026-10-28) remains the historical record of Render/Neon staging state; its environment claims were **not re-verified** here.

**Verdict:** the product is **not production-ready**. It is a substantial, actively hardened TypeScript monorepo with real native clients, but signed platform releases, staging end-to-end evidence, legal/privacy approval, independent penetration testing and several core roadmap features remain outstanding. One P0 privacy defect was found and fixed on the working branch in this session (see `SECURITY_REVIEW.md`).

## What this session could and could not verify

| Capability | Available here | Consequence |
|---|---|---|
| Source, full git history, 177 branches, 172 PR head refs | Yes (anonymous clone of public repo) | Code-level claims below are evidenced by file paths. |
| GitHub API (PR state, CI runs, reviews, issues) | **No** — `gh` token invalid; GitHub connector cannot read an unattached repo | PR open/closed/draft state, CI results and review comments are **unknown**. See `PR_INVENTORY_2026-11-22.md`. |
| Push / open PR | **No** (read-only access) | Changes are delivered as a git bundle and patch series for the owner to push. |
| npm registry / `pnpm install` | **No** (network off) | `pnpm run typecheck`, `pnpm run build`, browser checks not run. |
| Node built-in tests | Yes (Node 22.23, CI uses 24) with exact-version esbuild 0.28.2 found locally | 242/247 pass; 5 fail only on uninstallable packages. |
| PostgreSQL | Yes — local throwaway PostgreSQL 16.15 | New migration verified (14/14). |
| Android SDK / Google Maven, .NET/MSBuild, Xcode | **No** | No Android, Windows or iOS build was attempted. |
| Render, Neon, Cloudflare | Not used | No environment was inspected, changed or deployed. |

## Area matrix

Statuses use the directive's vocabulary. "Evidence" cites repository paths; CI evidence is from prior repository records, not re-observed.

| Area | Existing implementation (verified from source) | Missing work | Risk | Priority | Status | Evidence |
|---|---|---|---|---|---|---|
| Frontend (web) | React 19 + Vite 8 SPA, role portals, PWA install page, offline reconnect page, organizations/academics/materials/written-exam pages | Production build not run here; WCAG 2.2 AA audit not performed; organizations page had no consent step (fixed) | Medium | P1 | IMPLEMENTED BUT UNVERIFIED (this session) | `artifacts/training-platform/src`, `scripts/verify-installable-app.mjs`, `docs/INSTALLABLE_APP_RELEASE.md` |
| Backend API | Express 5, 45 route modules, server-side guards per route, origin/CSRF check on all mutations, early API rate limiter, privacy-safe error boundary, security headers | Org membership consent bypass and client-disabled learner requests still live on the server (both fixed on branch); static review of all 201 handlers done, runtime two-tenant tests not done | High | P0 | PARTIALLY IMPLEMENTED | `artifacts/api-server/src/app.ts`, `lib/originPolicy.ts`, `middlewares/rateLimit.ts`, `routes/*.ts` |
| Authentication | OIDC (openid-client) with PKCE, approved-origin callback, safe return paths, session-ID validation, native PKCE auth codes, privileged-MFA guard (feature-flagged) | Production identity provider config; privileged MFA enforcement is opt-in; `users.email` stored without `email_verified` (mitigated for invitations by requiring verified session email) | High | P0 | IMPLEMENTED BUT UNVERIFIED | `routes/auth.ts`, `routes/nativeAuth.ts`, `lib/sessionIdPolicy.ts`, `middlewares/privilegedMfaGuard.ts`, `docs/PRIVILEGED_MFA_ROLLOUT.md` |
| Authorization / tenancy | Org-scoped `guard()` helpers; guardian access requires verified relationship + latest per-school verification + active enrolment; school-data release middleware (flag-gated); superadmin access audited | Consent-less membership (fixed); no Postgres RLS (app-layer only); country-pilot enforcement off by default | High | P0 | PARTIALLY IMPLEMENTED | `routes/organizations.ts`, `routes/nativeParent.ts`, `lib/guardianPolicy.ts`, `middlewares/schoolDataRelease.ts` |
| Database | PostgreSQL + Drizzle schema (37 schema modules); 15 reviewed additive SQL migrations incl. new one; checksummed, advisory-locked migration runner | Base schema is created by `drizzle-kit push` (no full migration history from empty); backup/restore drill not evidenced; no RLS | High | P1 | PARTIALLY IMPLEMENTED | `lib/db/src/schema`, `lib/db/migrations`, `lib/db/scripts/migrate-learner-support.mjs` |
| AI | Groq primary provider via OpenAI-compatible client; model fallback, bounded retry policy, provider quota, AI observability with redaction; exam generation and partial-credit marking; opt-in learner AI profile and personalized plans; lexical RAG | No general tutoring chat; no safeguarding/distress classifier (deliberately absent); prompt-injection defences limited to source-grounding; evaluation suite partial; HF routing PR blocked on billing | High | P1 | PARTIALLY IMPLEMENTED | `lib/aiCompletion.ts`, `lib/aiProviderPolicy.ts`, `lib/aiRetryPolicy.ts`, `lib/providerQuota.ts`, `lib/materialRetrieval.ts`, `docs/RAG_PIPELINE.md` |
| Learner chat zone | None found (no peer messaging tables or routes) | Entire feature, moderation, reporting, minor-contact controls | High (child safety) | P1 — owner policy decision first | NOT IMPLEMENTED | search of `lib/db/src/schema`, `routes/` |
| Sports / talent / scouting | Sports & extracurricular design doc; attendance, notices, opportunities, development evidence routes | Scout search, sports performance data model, public leaderboards with privacy thresholds | High (minors' data) | P2 — owner/legal decision first | NOT IMPLEMENTED (scouting) / PARTIALLY (talent passport) | `routes/educationTalent.ts`, `docs/SPORTS_AND_EXTRACURRICULAR_DEVELOPMENT.md` |
| Android | Kotlin/Jetpack Compose app, 16 Kotlin files, `applicationId za.co.cabosolutions.learninghub`, minSdk 23 / targetSdk 35, version 0.1.0 (code 1); emulator UI tests and debug APK in CI | Release build type, secret-only signing and manual APK/AAB workflow added on branch (`d1e8ade`) but **never run**; no signed artifact; no physical-device evidence | High | P1 | PARTIALLY IMPLEMENTED | `native-apps/android/app/build.gradle.kts`, `.github/workflows/native-android-debug.yml` |
| Windows | C#/WinUI 3, .NET 8, `WindowsPackageType=None` (unpackaged); Debug x64 MSBuild in CI on `windows-latest` | **No installer/MSIX/release configuration**; no code-signing; live-login not verified | High | P1 | PARTIALLY IMPLEMENTED | `native-apps/windows/CABO.Native/CABO.Native.csproj`, `.github/workflows/native-windows-verify.yml` |
| iOS (not in directive scope, present in repo) | SwiftUI, 19 Swift files, XcodeGen; simulator build in CI | Signed IPA, TestFlight | Medium | P2 | PARTIALLY IMPLEMENTED | `native-apps/ios`, `.github/workflows/native-ios-verify.yml` |
| Security tooling | Custom tracked-file secret scanner (0 issues, 696 files), Gitleaks/Semgrep/ZAP in CircleCI, Snyk, code-safety workflow, Dependabot | CircleCI `security_suite` result unknown here; ZAP baseline skipped unless approved; Trivy not configured | Medium | P2 | IMPLEMENTED BUT UNVERIFIED | `scripts/security/`, `.circleci/config.yml`, `.circleci/security.sh`, `.github/workflows/code-safety.yml` |
| Infrastructure | Render build/start scripts (no blueprint file), guarded isolated-test startup, Cloudflare Django worker with `wrangler.toml`, optional Redis/QStash/Upstash Blob adapters (flag-gated) | No `render.yaml`; staging end-to-end not evidenced; backups/restore and monitoring alerting not evidenced; R2 foundation PR outstanding | High | P2 | PARTIALLY IMPLEMENTED | `scripts/render-*.sh`, `services/cloudflare-django-worker`, `docs/DEPLOYMENT.md`, `docs/INFRA_OPERATIONS_RUNBOOK.md` |
| CI/CD | GitHub Actions: verify (tests, typecheck, build, Playwright), code-safety, Android/iOS/Windows; CircleCI security suite; least-privilege permissions; stale-run cancellation | Production release approval gates/environments not defined; native release (signed) jobs absent | Medium | P2 | IMPLEMENTED BUT UNVERIFIED | `.github/workflows/*.yml`, `.circleci/config.yml` |
| Privacy / compliance | POPIA/Botswana applicability matrix, privacy notice drafts, DPA draft, consent records, notification consent, data-release gates | Qualified legal review; retention enforcement jobs; data-subject export/deletion workflows | High | P1 | PARTIALLY IMPLEMENTED (legal review BLOCKED on counsel) | `docs/legal/*`, `docs/PRIVACY_AND_CONSENT.md` |

## Baseline test evidence (summary)

Full details and exact commands: `TEST_RESULTS.md`.

- `node --test artifacts/api-server/src/tests/*.test.mjs` on unmodified main: **229/233 pass** with local esbuild; 4 fail on missing `zod`(v4), `typescript`, `@electric-sql/pglite`, `@upstash/blob`.
- On the working branch: **242/247 pass**; same 4 plus the new PGlite test fail only on missing packages.
- `scripts/test-*.mjs` (4 scripts): not runnable — require `express` from an installed workspace.
- Secret scanner: 0 issues. Shell/Node syntax checks for native demo scripts: pass.

## Open pull requests

172 PR refs exist. 101 are evidenced as merged or content-present in main; **71 cannot be proven in main** and their state is unknown without the GitHub API. They cluster into: native work (15), feature/other (15), pilot-branch backports (12), security/fix (10), documentation/checkpoints (10) and dependency updates (9). Feature/security work includes #95 and #180 (Groq/HF routing), #96 (admissions), #141 and #105 (Cloudflare), #165 (R2 knowledge), #181 and #187 (RAG). Consolidation recommendations are in `MASTER_COMPLETION_BACKLOG.md`. No PR was merged, closed or modified.
