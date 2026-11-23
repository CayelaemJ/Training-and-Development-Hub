# CABO Learning Hub — Release Readiness and Verification Register

**Review date:** 23 November 2026  
**Current repository observation:** `main` contains a full-system architecture reference, multiple native clients, core domain routes, security policies, migrations and release workflows. GitHub open-PR inventory returned **zero** on 23 November 2026. This is a repository housekeeping observation, **not a production-completion score**.

**Release decision: NOT VERIFIED AS PRODUCTION READY.** Historical 22 November findings remain historical records; changed implementation status must be validated against source, CI and real staging environments before being closed.

| Gate | Evidence now visible | Acceptance still required |
| --- | --- | --- |
| Web core | React/Vite, domain pages, API router, shared contracts | Current staged end-to-end role workflow, browser accessibility and deployment smoke |
| Backend security | Origin policy, rate limit, session middleware, MFA guard, privacy-safe error handling | Route-by-route two-tenant IDOR suite, independent security assessment, production IdP and MFA enforcement |
| Data model | Drizzle schema modules and November migrations | Reviewed migration bootstrap, separate staging, restore drill and recoverability proof |
| AI | Generation/marking, lexical RAG, source citations, quota and evaluation scaffolding | Representative educational evaluation, prompt-injection and consent testing; human review |
| School privacy | Guardian, institution, country and release-gate policies | Legal and institution approval, country applicability, tested current relationship and revocation |
| Notifications | Consent/eligibility, outbox and dispatcher code | Delivery proof, replay/idempotency, retention and recipient verification |
| Android | Native code plus Android release CI definition | Actual signed artifact, emulator/device matrix, install and publication evidence |
| iOS | Native Swift code and verification workflow | macOS/Xcode run, device acceptance, signing and publication evidence |
| Windows | WinUI 3, unit tests, installer sources and release workflow | Signed installer, clean-install/upgrade evidence, OS compatibility |
| Monitoring | Health/readiness endpoints, logging, platform health sources | Alert destination, load thresholds, incident simulation and owner review |
| Hosting | Render-oriented scripts, Cloudflare staging/candidate assets | Confirm deployed SHA, domain, cookies, persistence, HTTPS, backups and rollback |
| Compliance | Legal drafts and release gates for ZA/BW | Independent legal sign-off and approved processing agreements |
| Independent review | PR checks and code review sources vary by commit | Final release-specific independent approval and documented evidence |

### Historical audit reconciliation

The 22 November [production audit](PRODUCTION_COMPLETION_AUDIT.md) and [security review](SECURITY_REVIEW.md) record findings at their specific branch/time. Do not silently rewrite them as if tests ran on 23 November. Their observations about absent Android release or Windows installer may be superseded by later source on `main`, but signed-release evidence remains outstanding. A missing open PR does not imply that every requested capability is implemented.

### Release acceptance checklist

1. Capture exact main commit and actual running deployment commit.
2. Run frozen-install, typecheck, build, unit/contract, integration and security workflows; record failures and skipped checks.
3. Exercise two institutions, two guardian contexts and revoke/change-role scenarios, including native device account switching.
4. Prove DB bootstrap/migration and isolated backup restoration.
5. Validate document storage approval/deletion, notification dispatcher, AI provider error paths and money-ledger replay.
6. Run approved synthetic staging E2E and platform-native tests.
7. Obtain legal/processor/child-data, security and release approvals.
8. Roll out with telemetry and documented rollback; record actual smoke results.

**Related:** [full architecture](../ARCHITECTURE.md) · [infrastructure gaps](../PLATFORM_INFRASTRUCTURE_GAPS.md) · [native release](../../native-apps/FEATURE_PARITY.md) · [engineering backlog](MASTER_COMPLETION_BACKLOG.md).
