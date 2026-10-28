# Free-first infrastructure rollout (CABO Learning Hub)

This is a deployment plan and implementation register, **not** a statement that external products have been provisioned or verified end-to-end. Keep the platform's core records in its existing Neon PostgreSQL project and API/UI on Render. No Railway dependencies should be used for new deployments. Avoid adding paid capacity without a plan/billing review.

## Phase 1: Redis distributed abuse protection (implemented in this PR)

The API now accepts **Upstash Redis REST** as an optional distributed rate-limit store. Existing IP/scope thresholds remain unchanged. All scopes for one request are evaluated atomically in one EVAL command. Keys are pseudonymous SHA-256 hashes and expire after their fixed window. No sensitive learner data, extracted study materials or session tokens are put in Redis.

Set **server-side only** in Render (never in the Vite / native clients):

- `UPSTASH_REDIS_REST_URL`: HTTPS endpoint of an **already created free-tier** Upstash Redis database.
- `UPSTASH_REDIS_REST_TOKEN`: corresponding secret REST token; never expose or commit.
- `CABO_REDIS_PREFIX=cabo-learning-dev` for synthetic preview and `cabo-learning-prod` for an approved production environment. Every app must have a distinct prefix or database.
- `CABO_RATE_LIMIT_SALT`: private, stable random value for pseudonymous IP keys. Keep distinct by environment.

Both Upstash settings are required together. When neither is supplied, the bounded in-memory limiter remains for development and a **single-replica** demo only; it cannot enforce limits across replicas. If one is missing or Redis becomes unreachable once enabled, the API denies requests with HTTP 503 rather than bypassing protection. The `/api/healthz` and `/api/readyz` probe endpoints remain accessible. The application does **not** create Redis databases automatically and does **not** switch this on without credentials.

**Validation before release:** `pnpm install --frozen-lockfile`; `node --test artifacts/api-server/src/tests/redisRateLimit.test.mjs`; `node --test artifacts/api-server/src/tests/*.test.mjs`; `pnpm run typecheck`; `pnpm run build`; confirm 429/Retry-After and Redis-down 503 behavior on a synthetic Render preview; run browser and Android smoke tests. Check Upstash free command quotas (one EVAL REST request per protected API request) and network RTT before enabling on high-traffic environments.

**Security/cost:** never use Redis as the source of truth for permissions, transcripts, marks, guardian relationships or payments. Obtain the actual free-tier quotas and verify billing settings. Roll back by reverting the deployment; avoid intentionally unsetting a configured Redis token on public multi-replica deployments as doing so switches to local-only limiting.

## Phase 2: Storage and asynchronous work (not yet provisioned)

- Use **private bucket storage** for upload files, study materials, certificates and other binary files, with metadata in Postgres. Neon object storage is enabled on the existing Learning Hub branch, but no bucket was present at audit time. The current app has GCS-backed storage and a legacy testing-only database blob path; plan a reviewed S3 adapter with signed URLs, ownership checks, encryption, malware scanning, per-tenant quotas, lifecycle rules, and audited deletion.
- **QStash** is a candidate for document extraction, AI generation, notifications and reports. Before adding public callbacks, verify Upstash-Signature against **raw** request bodies and signing-key rotation, plus idempotency keys, explicit retries, dead-letter handling and quotas. Never include school/guardian PII or secrets in a job payload; send an opaque job ID.
- Keep AI upstream quota and failover handling separate from Redis; do not use caching to bypass the provider's 429.

## Phase 3: Search / local-first / telemetry (not yet provisioned)

- **pgvector** extension v0.8.6 is now enabled on the existing `cabo-learning-hub` Neon database (28 October 2026), but **no embeddings, RAG tables, search API or vector indexes were created**. A documented tenant/consent-aware search implementation must still be reviewed before storing learner-related embeddings. Require embedding dimension/model migration policy, tenant/consent filters in SQL, sensitive content minimisation and vector deletion when consent expires.
- **Qdrant** only if isolation/search-scale benchmarks justify another store. Do not copy learner PII into an unmanaged cluster.
- **Turso** may support offline-first non-sensitive content sync, but device-side encrypted caches and authoritative conflict resolution come first. Postgres remains canonical.
- **MongoDB Atlas or Catalyst NoSQL**: use only for genuinely document-heavy low-risk workloads that Postgres JSONB cannot serve as well; do not replicate entire user profiles across stores.
- **PostHog**: consent-aware, pseudonymous, low-cardinality events and feature flags. No student grades, identifiers or health data in analytics.
- **OpenTelemetry/Grafana**: measure API p95/p99 latency, database saturation, cache hit ratio, queue depth and failure rates; redact credentials, learner IDs, emails and document text.
- **Zoho Catalyst**: an optional development-only pilot for Functions, Stratus and Data Store/NoSQL. Confirm Catalyst free-tier and charging conditions before resource creation.

### Verified database extensions (28 October 2026)

On the existing CABO Learning Hub Neon database only, `vector` 0.8.6 and `pg_stat_statements` 1.12 were enabled and independently verified with a read-only `pg_extension` query. Extension installation itself does not provide full-text/vector RAG or observability dashboards, and it does not change the Neon account's **Launch** billing plan. Do not copy production learner data to a secondary vector store without permission, retention and deletion controls.

## Release gating

A running database or a passing typecheck is not a working launch. The complete release gate includes: independent security review; POPIA/Botswana privacy assessment; verified parent/guardian consent; end-to-end academic and admissions flows; real API/AI provider smoke tests; backups/restores; signed file access; deployment and rollback drills; mobile/Android + desktop/browser accessibility and latency tests; monitoring and incident response.

Only graduate an integration from **candidate** to **enabled** after reviewing quotas, configuring its keys privately, verifying synthetic data and demonstrating all tests in the target environment.
