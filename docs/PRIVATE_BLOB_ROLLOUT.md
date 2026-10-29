# CABO private document storage: staged Upstash Blob adapter

## What has been implemented

The Express API now supports an **optional** private Upstash Blob backend for study materials, using the official `@upstash/blob` SDK pinned to version `0.0.11`. New uploads can use a same-origin upload URL, preserving the web and native clients' existing PUT contract. The file bytes are proxied through the authenticated API to allow magic-byte checks, MIME consistency checks, per-owner intent checks, and exact size validation before storage. This is a conservative **8 MiB pilot limit**, not the final large-file flow.

The storage key is an opaque UUID under `private/materials/` and contains no names, IDs, school labels, filenames, or document text. The API tracks ownership in Postgres. Saved materials are read through the same existing document-preview/quiz flows; the private download endpoint requires a **study-material ownership lookup** and issues a one-minute signed URL. Material deletion deletes the private object first, then the existing database row. The QStash signed preview worker also reads the new storage format.

The application keeps existing object-storage implementations for old material paths; there is no bulk migration, cleanup, or deletion of existing data.

## Explicit activation gates

The feature defaults **off**, regardless of whether the SDK is installed. To activate for **synthetic school/test data only**:

1. Verify the actual bucket is private and has no public host. In Upstash, use the `cabo-learning-private-documents` bucket, not an arbitrary or public bucket.
2. Confirm Upstash's current free-tier limits, bandwidth/operations usage, failure behavior after caps, and any account-level payment method. The provider's free caps are an external safety backstop, not a reason to skip app budgets.
3. Review and approve data-processing agreements, sub-processors, country/region replication, POPIA/Botswana children's-data transfers and retention, and the guardian consent model **before** school data is sent. The legal review must be evidenced; a configuration flag alone does not constitute approval.
4. Set server-only Render variables `UPSTASH_BLOB_TOKEN` (private bucket token), `CABO_BLOB_UPLOADS_ENABLED=true`, and `CABO_BLOB_PRIVACY_REVIEW_APPROVED=true`. Do not put the token in `VITE_*`, the codebase, logs or public config. The last flag should only be set **after** an actual review; do not use it to bypass compliance.
5. Ensure `RENDER_EXTERNAL_URL` matches the deployed approved application URL. Upload URLs derive from trusted application origins, **not** untrusted `Host` or forwarded headers.
6. Exercise synthetic web/Android sessions: valid 8 MiB-or-less uploads, malformed files, MIME mismatch, other-account denial, expired upload intent, private signed download, revoke/delete, failed storage, concurrent requests, and app rollback.
7. Do **not** turn on `ENABLE_QSTASH_MATERIAL_PREVIEW` until the optional document-reading migration, consent columns, worker signing keys, and separate worker E2E tests all pass.

When the Blob flag is off, existing upload behavior remains unchanged. Existing Blob object reads still require the server token even after new uploads are disabled, to allow a safe rollback of new writes.

## Current safeguards

- 8 MiB maximum per private upload (the legacy 30 MiB provider limit is unchanged).
- 48 MiB approximate per-account recorded storage budget, 512 MiB aggregate recorded budget, and no more than 5 outstanding unexpired intents per account. These are preflight limits; concurrent reservations may race, and incomplete uploads can remain orphaned. **These are not hard transactional quotas.**
- UUID-only object paths with no caller-selected key, path traversal or sensitive filename.
- Fail closed if the feature is requested but private bucket credentials or privacy flag are missing.
- Authenticated same-origin PUT, owner-scoped upload intent (15-minute validity), declared MIME and binary signature validation, exact byte count and private object metadata check.
- Private objects served only through one-minute signed URLs after checking document ownership; `Cache-Control: private, no-store`.
- Consent-gated text extraction remains governed separately; uploading does not mean agreeing to AI reading.
- SDK telemetry disabled.

## Outstanding release blockers

**This is not yet approved for real learner, guardian, birth-certificate or admissions records.**

- Complete external security and privacy review; ensure country residency/replication commitments are verified.
- Add malware scanning/quarantine for untrusted documents, and verify Office/ZIP decompression limits.
- Implement durable cleanup of abandoned uploads and orphan objects, deletion retry/outbox, backup/restore and restore tests. A user may upload bytes and abandon material registration.
- Add transactional quota reservation / reconciliation against actual bucket usage; do not describe the present preflight totals as exact.
- Direct browser-to-storage multipart uploads are a future optimization, not in this pilot proxy (Render request body and memory costs apply).
- Run independent authenticated two-school, two-guardian and Android UI acceptance tests against a synthetic Render preview. CI tests and TypeScript compilation are not substitutes for these tests.
- Confirm successful Upstash SDK integration using a synthetic file **without** exposing signed URLs or bucket tokens to logs.
- Rollback: set `CABO_BLOB_UPLOADS_ENABLED=false` to stop new uploads. Keep `UPSTASH_BLOB_TOKEN` available while any objects created under the pilot remain, or reads/deletions will fail.

## Test commands

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
node --test artifacts/api-server/src/tests/*.test.mjs
pnpm --filter @workspace/api-server run build
```

No new paid Render service, Neon bucket or database migration is required by this adapter. Live bucket operations, stored bytes and data-transfer limits still require ongoing monitoring. See issue #107.
