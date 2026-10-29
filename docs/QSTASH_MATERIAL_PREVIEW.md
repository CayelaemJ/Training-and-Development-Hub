# Signed, free-tier background material previews

**Status:** implementation in a review branch, **disabled by default**. This is not a finished production release and does not create additional databases, cloud buckets, or a paid service.

## Scope

The authenticated `POST /api/materials/:id/preview-jobs` queues a background, text-only document preview for an existing, owned learning material of at most **2 MB**. The server checks `allow_ai_reading` consent and only queues an opaque material integer, no learner name, user ID, document bytes, text, or prompt.

A `POST /api/internal/qstash/material-preview` callback verifies the **raw** body against QStash's `Upstash-Signature` JWT (HMAC-SHA256, both signing keys for rotation, issuer, exact destination URL, expiration/nbf, body SHA256). The worker takes a PostgreSQL advisory lock, checks material existence and consent again, extracts text **without OCR or calling any AI model**, and writes the cache only if consent still exists in the same UPDATE statement. Duplicate deliveries are harmless. Non-text/scanned materials are not automatically sent to an external AI provider.

The current authenticated `GET /api/materials/:id/preview` remains the read endpoint. Existing synchronous upload and quiz flows are unchanged.

### Free-tier setup (Render server-side only)

Do not enable this on school/student datasets before the document-reading migration, storage, privacy review and synthetic E2E tests.

- `ENABLE_MATERIAL_READING=true` **only** after reviewing and applying `lib/db/migrations/20261021_material_reading.sql` to the intended database.
- `ENABLE_QSTASH_MATERIAL_PREVIEW=true` after all prerequisites pass; otherwise routes return 503/404 and no messages are sent.
- `QSTASH_TOKEN`: server-side EU-region QStash publish token. Never expose to clients or GitHub.
- `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`: EU-region QStash callback signing keys.
- `QSTASH_MATERIAL_PREVIEW_URL=https://<approved-preview-host>/api/internal/qstash/material-preview`: full, fixed **HTTPS** URL matching the deployed host exactly; do not derive it from user-controlled request headers.

**Avoid** activating on the current pilot until its document-storage backend has been migrated off the obsolete local signing sidecar and a working private bucket is verified. Neon branchable storage is available but bucket creation, egress and Launch-plan pricing need approval; do not assume free object storage on the currently billed Neon Launch organisation.

### Tests and release gates

1. Run `node --test artifacts/api-server/src/tests/qstashMaterialPreview.test.mjs`, then `pnpm run typecheck && pnpm run build` and the existing CircleCI, Snyk and security suite.
2. Against a synthetic, access-controlled test database with the approved migration and **verified** private file storage, prove: unauthenticated queueing 401, cross-owner queueing 404, unconsented queueing 403, oversized file 422, payload contains only version and material ID, forged/mismatched/expired callback 401, permitted plain-text file extraction, duplicate callback safe, revoked consent no write, missing file retries, and source deletion no orphaned cache.
3. Confirm the QStash free-plan regional quotas and **HTTP timeout** meet the small-file processing time including free Render wake-up; do not claim durable long-running AI generation is ready on this path. QStash's free tier may exhaust retries while a sleeping instance starts.
4. Check cost/usage, school isolation, deletion/retention, POPIA and Botswana data-processing constraints, and rollback before any public production rollout.
5. Only enable on real school data after guardian/learner privacy review and signed permission for file-text retention.

### Why this is separate from quiz generation

Quiz generation can take longer than a QStash free-tier callback timeout and may consume external model quotas. A durable job ledger and resumable workflow with explicit provider budgets are required before converting it to an asynchronous job. This PR intentionally does **not** claim full AI queues, signed document uploads or vector indexing are complete.
