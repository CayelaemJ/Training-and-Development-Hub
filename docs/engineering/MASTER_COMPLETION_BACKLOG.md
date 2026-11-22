# Master completion backlog

**Date:** 2026-11-22 · **Baseline main:** `5a30e1c9bbcf44d9e2f3d8c17f41b9109316061f`
**Sources:** repository source and git history; PR refs via git only (see `PR_INVENTORY_2026-11-22.md`). GitHub issues were **not** readable from this session and are not included.

Priority: **P0** production blocker · **P1** core product completion · **P2** operational readiness · **P3** enhancement.
"Owner" means a decision or external evidence only the project owner (or counsel, an institution, a platform vendor) can supply.

## P0 — production blockers

| ID | Item | Related PR | Components | Required implementation / acceptance criteria | Required tests | Impl. status | Verification | Commit |
|---|---|---|---|---|---|---|---|---|
| P0-01 | **Consent-less organization membership + account/name disclosure** | — (found this session) | `routes/organizations.ts`, `lib/organizationInvitationPolicy.ts`, `lib/db/migrations/20261122_organization_invitations.sql`, `pages/organizations.tsx` | Adding by email creates an invitation; identical 202 for every email; membership only after invitee accepts with provider-verified email; row-locked acceptance; managers can list/revoke. | Policy unit (8), source contract (5), PGlite DDL (CI), local Postgres 16 harness (14) | COMPLETE ON BRANCH | Unit/contract/Postgres pass; **typecheck, web build, staging E2E not run** | `602c830`, `3b76778`, `83fb70e` |
| P0-02 | Apply migration `20261122_organization_invitations` before deploying P0-01 | — | Render pilot DB | Run `node lib/db/scripts/migrate-learner-support.mjs 20261122_organization_invitations` against **staging first**, then production, with owner authorization. Until applied, inviting returns 500 (fails closed: no direct add). | Staging smoke: invite, accept, decline, revoke, cross-org | NOT STARTED | — | — |
| P0-03 | Run `pnpm run typecheck && pnpm run build` and browser checks on the branch | — | all | CI `verify` must pass on the pushed branch | CI | BLOCKED (no registry here) | — | — |
| P0-04 | Confirm PR #58/#59/#60 are superseded by main, then close or rebase | #58 #59 #60 #89 | auth, origin policy, native parent | Main already contains origin-checked mutations, OIDC host/return-path validation and per-school guardian verification (`lib/originPolicy.ts`, `routes/nativeParent.ts`). Confirm each PR's remaining diff is empty or obsolete. | Existing `originPolicy`, `nativeGuardianReports`, `parentMobilePolicy` tests | IMPLEMENTED (on main) | PR state unknown | — |
| P0-05 | Production identity configuration and privileged MFA enforcement | #132 (merged) | auth | Owner configures production OIDC provider; decide whether `privilegedMfaGuard` is enforced for owner/admin/superadmin before launch. Store only `email_verified` addresses or keep all email-trust decisions on `verified_email`. | `mfaAssurance` tests + staging login | PARTIALLY IMPLEMENTED | Owner | — |
| P0-06 | Independent penetration test and route-by-route authorization review | — | API | Every `/:orgId` and `/:id` route reviewed for object-level checks with two-tenant negative tests | Synthetic two-tenant integration suite | NOT STARTED | — | — |
| P0-07 | Backups and tested restore for the production database | — | Neon/Render | Documented, executed restore into an isolated branch with checksum comparison | Restore drill record | NOT EVIDENCED | Owner (infra access) | — |

## P1 — core product completion

| ID | Item | Related PR | Status | Next step / acceptance | Blocker |
|---|---|---|---|---|---|
| P1-01 | Android release build type, signing config from CI secrets, AAB | — | NOT IMPLEMENTED | Add `release` buildType reading keystore from env/CI secrets only; `bundleRelease`; mark unsigned outputs as such | Owner supplies upload keystore (never committed) |
| P1-02 | Windows installer (MSIX or packaged) + release configuration | #41 | NOT IMPLEMENTED | Release x64 build, MSIX packaging, install/upgrade/uninstall on a real Windows runner | Code-signing certificate (owner) |
| P1-03 | Native parity work not provable in main | #112–115, #129, #134, #150–154, #160, #169 | UNKNOWN | Main contains "Native Phase 10–20" commits; diff each PR against main and close superseded ones | GitHub API access |
| P1-04 | Learner chat zone (moderated, teacher-supervised) | — | NOT IMPLEMENTED | Owner approves a child-safety policy first: no learner-to-learner DMs by default, teacher-moderated class channels, report/block, retention, no contact details | Owner policy + legal review |
| P1-05 | AI tutoring chat with layered safety | #95, #180, #181, #187 | PARTIALLY | Reuse `aiCompletion` + quota + retry; add input/output classifiers, per-learner rate limits, no learner PII in prompts, refusal templates, eval set | Owner decision on HF routing (#95 billing blocked) |
| P1-06 | Safeguarding escalation process (no AI "diagnosis") | — | NOT IMPLEMENTED | Human-reviewed concern flags routed to approved school safeguarding contacts only; no automatic guardian disclosure | Owner + school policy + legal basis |
| P1-07 | Admissions & transfers | #96 | PARTIALLY | Keep draft until institution, child-data and jurisdiction gates pass | External gates |
| P1-08 | Effective scores incorporate assessor overrides | — | NOT IMPLEMENTED | README records overrides are audited but not applied to dashboards | — |
| P1-09 | Data-subject export and authorized deletion workflows; retention enforcement | — | PARTIALLY | Implement per POPIA/BW gap assessment | Counsel |
| P1-10 | Qualified legal review of POPIA/PAIA/Botswana DPA position | — | BLOCKED | `docs/legal/*` are drafts | Counsel |

## P2 — operational readiness

| ID | Item | Related PR | Status | Note |
|---|---|---|---|---|
| P2-01 | Guardian-link request is an account-existence oracle (`POST /guardian-relationships` returns 400 for unknown email) | — | NOT STARTED | Return uniform response; guardian must still accept. Lower severity: no name disclosure. |
| P2-02 | Postgres row-level security as defence in depth | — | NOT IMPLEMENTED | App-layer checks only today |
| P2-03 | Full migration history from an empty database (base schema is `drizzle-kit push`) | — | PARTIALLY | Generate a reviewed baseline migration and test clean install + upgrade |
| P2-04 | Render blueprint (`render.yaml`) for reproducible staging/production | #73 #78 #80 | NOT IMPLEMENTED | Consolidate the three Render runbook PRs into one |
| P2-05 | CircleCI `security_suite` status and ZAP approval | #51 (merged), #194 (content on main) | UNKNOWN | Needs CircleCI log access |
| P2-06 | Monitoring/alerting to an external channel | #125 (merged) | PARTIALLY | Safe error telemetry exists; delivery not evidenced |
| P2-07 | Dependency updates | #53 #54 #94 #161 #166 #190–193 | UNKNOWN | Several are major bumps (TypeScript 6, framer-motion 14, @types/node 26); test individually |
| P2-08 | WCAG 2.2 AA audit of web and native | — | NOT STARTED | Use axe + manual screen reader passes |
| P2-09 | Pilot-branch backports | #103 #108 #111 #119 #123 #128 #135 #136 #140 #143 #147 #149 | UNKNOWN | Decide whether the separate pilot branch is still deployed; if not, close backports in favour of main |

## P3 — enhancements

| ID | Item | Related PR | Status |
|---|---|---|---|
| P3-01 | Sports analytics and authorized scout search with consent and aggregation thresholds | — | NOT IMPLEMENTED (owner/legal decision first) |
| P3-02 | R2 AI knowledge store | #165 | UNKNOWN |
| P3-03 | Cloudflare full-stack hosting option | #105 #141 | UNKNOWN — keep Render as current architecture unless owner decides otherwise |
| P3-04 | Lifelong passport branches superseded by main | #44 #92 | Likely superseded (main has passport migrations) |

## Recommended PR consolidation (requires owner action on GitHub)

1. **Close as superseded after a diff check:** #58, #59, #60, #89 (security hardening present on main); #44, #92 (passport on main); #65, #73, #76, #78, #80, #91, #93 (checkpoint/runbook docs overtaken by later docs).
2. **Rebase and decide:** #95 vs #180 (same Groq/HF routing intent — keep #180, the refresh); #181 and #187 (RAG; land #181 first).
3. **Decide pilot branch future** before touching the 12 pilot backports.
4. **Dependency PRs:** merge non-major groups after CI; treat TypeScript 6 and framer-motion 14 as separate migrations.
