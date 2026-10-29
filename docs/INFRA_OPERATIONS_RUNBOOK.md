# CABO Learning Hub — free-tier infrastructure operations

This runbook covers **opt-in operational checks** that do not add services, spend quotas continuously, or upload learner records.

## State / environments
- Render Learning Hub pilot: \`cabo-learning-hub-pilot\`; no additional Render workers provisioned.
- Redis: Upstash REST rate limiting; no native Redis TCP instance required.
- Private documents: Upstash Blob; no public bucket, no personal data in paths.
- Database: existing Neon PostgreSQL and optional pgvector extension.
- Background callbacks: QStash signature-verified, material-preview jobs disabled until consent and storage acceptance tests pass.

## Redis readiness

The existing \`/api/healthz\` liveness route remains cheap and independent of cloud dependencies. \`/api/readyz\` keeps checking the database. To additionally verify **Upstash Redis**, set the server-only flag:

\`\`\`
CABO_REDIS_READINESS_CHECK=true
\`\`\`

The Redis probe uses only \`PING\`, returns no credentials/diagnostic internals, times out after 1.2 seconds, and caches healthy results for five minutes (unhealthy results for 30 seconds). Concurrent probes share the same request. If Redis is misconfigured or unreachable, \`/api/readyz\` returns the generic status \`dependency_unavailable\` with HTTP 503, never a successful readiness status.

**Do not enable** until the monitoring frequency, free-tier monthly commands and false-positive cold starts are assessed. Existing \`/api/healthz\` remains the liveness check, so an outage doesn't create a restart loop. This is not full distributed tracing, latency dashboards, or external alert delivery.

## Private Blob inventory audit: read-only

From a developer terminal with the approved database access and the **private** Upstash bucket token, run:

\`\`\`bash
CABO_BLOB_AUDIT_ENABLED=true \
  UPSTASH_BLOB_TOKEN="<server-side private bucket token>" \
  pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/src/scripts/auditBlobStorage.ts
\`\`\`

The script never uploads, deletes, changes permissions or migrates any data. It lists at most 5,000 private Blob objects and 5,000 paths per database table, refusing to report success on a truncated inventory. It classifies provider objects as matched to saved study materials, matched to recent upload intents, or **unreferenced candidates for human review**. Expired upload-intent counts are reported separately.

The JSON output contains only aggregate counts and bytes; no learner ID, document name, storage key, private signed URL or bucket credential. The script exits nonzero on missing approval, invalid keys, excessive inventory, database errors or provider failure. Provider object timestamps and retention/consent rules must be reviewed **before** any deletion; a candidate is not proof it is safe to delete.

The audit also compares database references to physical objects. It does not prove malware-free files, reconstruct corrupted files, or test recovery from backups. When scaling past 5,000 objects per inventory, implement pagination by tenant and a bounded cursor-backed comparison rather than raising the cap without measuring impact.

## Free-tier and release limits

1. Verify Upstash Redis monthly command and rate-limit usage. A PING per five minutes only occurs if a readiness checker calls the route and the optional flag is on.
2. Verify the Upstash Blob bucket is still private, monthly byte/operations quotas, and provider behavior when the free allowance is exhausted. Do not activate uploads for sensitive school documents without documented POPIA/Botswana processing agreements and data-transfer assessment.
3. Verify QStash delivery failures and DLQ before enabling real jobs; no personally identifying queue payloads.
4. Neon extensions \`vector\` and \`pg_stat_statements\` being installed does **not** mean tenant-safe vector retrieval is deployed. Validate SQL row isolation, signed embeddings, retention and cost budgets before use.
5. Add malware scanning/quarantine, orphan reconciliation and deletion workflows, durable outbox and two-account browser/Android testing before activating real private uploads.
6. Do not enable telemetry that collects learner names, prompts, admission documents, grades, parent contact details or raw request bodies. Browser analytics requires explicit privacy treatment and applicable consent.
7. Review Neon account billing separately: its active project was previously on the **Launch** plan; this PR does not change it or create additional databases.

## Verification

\`\`\`bash
pnpm install --frozen-lockfile
pnpm run typecheck
node --test artifacts/api-server/src/tests/*.test.mjs
pnpm run build
\`\`\`

Rollout: merge only after CI; separately promote the same code onto the live Render pilot branch and verify its deployment before turning on \`CABO_REDIS_READINESS_CHECK\`. The Blob audit remains a manual, opt-in **read-only** operation. Existing feature flags and credentials are not modified by this PR.
