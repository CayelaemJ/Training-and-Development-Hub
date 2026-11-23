# CABO storage pilot: R100/month spending target (9 Nov 2026)

## Verified resource
- Cloudflare account: CABO-connected account (account ID is held in Cloudflare; do not copy credentials into Git).
- Bucket: `cabo-learning-staging-private` (Standard tier, location hint Western Europe; **default jurisdiction**, not an EU data-residency guarantee).
- Public managed `r2.dev` domain: **disabled** at verification.
- Lifecycle: `temporary-exports/` deleted after 1 day; `quarantine/` deleted after 7 days; existing automatic multipart-abort rule preserved.
- **Only synthetic, non-personal test files permitted.** No production learner records or documents with child-identifying content until cross-border privacy, subprocessor terms, and data-location requirements are independently approved.

## Spending scope
- User target: **R100/month total CABO storage/AI experiment**. This is a spending target, **not a guaranteed account-wide hard cap**. Billing is in USD; USD/ZAR varies, and taxes/other Cloudflare services may apply.
- R2 free Standard tier: 10 GB-month, 1 million Class A operations, 10 million Class B operations. Free allowance is shared at account level. Do not use Infrequent Access.
- **Pilot application quotas (to implement before enabling writes):** 2 GB persisted usage, 8 MiB max file, 10,000 write/list operations and 50,000 read operations per billing month, with conservative account-wide headroom. Count reserve operations, pending uploads, multipart parts and retries. Fail closed on unknown quota state. Quotas must be transactionally enforced in a durable DB, not in-memory checks.
- Until quota enforcement and cost telemetry exist, keep `CABO_R2_STORAGE_ENABLED=false` and `CABO_RAG_INGESTION_ENABLED=false`.
- Do not activate paid Vectorize, AI Search, embedding models, paid Workers, or model fine-tuning without a separate cost assessment.
- Reuse existing Groq/Hugging Face integration and document parsing on synthetic test materials; no automatic calls to paid inference triggered by upload.
- Set a low account-wide **budget alert** if account plan allows. Cloudflare billing alerts are email notifications, **not enforced ceilings**. If alert endpoint is unavailable, set via dashboard > Manage Account > Billing > Billable Usage. Suggested early warning at USD $2, second warning at USD $4 (adjust for current FX/tax and any other account costs).
- Expose an operator-only cost dashboard: stored GB-month estimate, Class A/B operations, queue usage, inferred provider tokens/cost, daily remaining quota and predicted month-end total.
- Configure a manual emergency-off procedure for upload and ingestion flags; on alarm stop new writes/inference, keep authorised reads and deletion available.

## Rollout gate
1. Confirm existing bucket domain remains disabled; verify lifecycle read-back.
2. Add server-side R2 adapter and tenant-bound upload/download ACL checks, plus durable budget counters and a month-reset routine that follows actual billing periods.
3. Add synthetic tests for quota exhaustion, malicious files, cross-tenant access, consent withdrawal, duplicate processing and zero paid inference when disabled.
4. Run CI; execute minimal synthetic smoke tests without incurring paid AI charges.
5. Only after reviews, turn on staging flags. Production rollout requires separate approval.

Reference: `docs/r2-ai-knowledge-foundation.md` and issue #164.

## Implemented in draft PR #165 (9 November)
- `artifacts/api-server/src/lib/r2Staging.ts`: disabled-by-default private R2 API adapter, 8 MiB cap, bounded GET stream, opaque keys and strict staging bucket identity.
- `lib/db/migrations/20261109_r2_staging_budget.sql`: **not applied**. New accounting and institution-bound object tables.
- `artifacts/api-server/src/lib/r2BudgetLedger.ts`: PostgreSQL-transaction-backed quota reservations, quarantined-byte confirmation, approved-object read budget, tombstone and verified-delete acknowledgement. This module is NOT connected to the HTTP layer; tenant membership still needs to be resolved and verified there.
- `artifacts/api-server/src/tests/r2Staging.test.mjs` and `r2BudgetMigration.test.mjs`: negative contract and isolated PGlite schema tests. Do not claim passing before CI confirms them.
- R2 synthetic remote upload/download/delete was successful and the temporary object was removed.

## Testing (from repository root)
```sh
pnpm --filter @workspace/api-server exec node --test src/tests/r2Staging.test.mjs src/tests/r2BudgetMigration.test.mjs
pnpm run typecheck
```
Do not run schema changes against production as part of this procedure. Use a disposable staging PostgreSQL database for integration concurrency tests. Migration SQL contains `CREATE TABLE` statements, not sensitive data.

## Important limitations
- The 2 GiB budget counts data routed through this ledger, not objects uploaded directly with separate Cloudflare credentials or other services in the account.
- Read/write counters reserve *application operations*, not every Cloudflare billable Class A/B operation (e.g., retries, cleanup calls, scanning and manual operations). Reconciliation and observability must be implemented before declaring a hard cost guard.
- Automatically deleting a quarantine R2 object after 7 days does not automatically decrement DB accounting. A reconciler must verify R2 absence and settle the tombstone safely.
- The R2 bucket has a Western Europe location hint but the default jurisdiction; a geographical hint is not a legal EU residency guarantee.
- Approval of an uploaded object and AI indexing are deliberately absent until scanning, explicit consent and access checks exist.
