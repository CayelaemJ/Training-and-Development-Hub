# CABO R2 storage and grounded AI ingestion: implementation contract

Status: **design + safety gates only**. No production R2 provisioning, no enabled uploads, no AI training, no schema migration. Cloudflare R2 currently returns `10042: Please enable R2 through the Cloudflare Dashboard`.

## Existing baseline (preserve)
- Express `/storage/uploads/request-url` and `/storage/uploads/blob/:id` provide authenticated upload intents and validate file size/type/signature.
- `privateBlob.ts` provides an 8 MiB pilot via Upstash with explicit privacy review approval.
- `objectStorage.ts` uses a Replit object-storage sidecar; Railway testing has a distinct fallback.
- `allowAiReading` already exists as an opt-in. Do not turn it on by default or bypass existing material access checks.
- The staging Django insights Worker is deliberately stateless and does not process raw child data; existing EU staging queues are not yet connected to a consumer.

## R2 rollout
1. Enable R2 in the approved Cloudflare account via authorised console/billing owner. Do not provision without checking privacy, residency and cost approval. Use separate `dev`, `staging`, and `prod` environments.
2. Start with private **quarantine**, **approved-content**, and **temporary-exports** buckets. Create more buckets only for independently required lifecycle/retention policy. Logical categories (curriculum, classroom, assessments, learner records) are metadata/prefix classifications, not automatic public buckets.
3. Store object keys as random IDs under opaque prefixes. Never put learner names, emails, school names or untrusted filenames in keys. File records remain in PostgreSQL with `tenant_id`, `owner_id`, category, classification, size, checksum, content type, consent status, purpose, retention deadline, object version and processing state.
4. Keep the existing client contract intact. Add a disabled-by-default `CABO_STORAGE_PROVIDER=r2` selection and tenant-scoped server-side authorisation before issuing short-lived upload intents. For direct browser uploads, bind intent to expected key, maximum bytes, MIME, checksum and expiry; verify bytes at finalisation. Avoid public R2 URLs. Provide signed downloads only after a fresh object-level permission check.
5. Quarantine every new upload. Check verified signature, decompression limits, AV scan and approved file classification *before* promoting an immutable copy to approved storage. Queue processing after committed metadata state, with a durable outbox. Never trust webhook or queue payloads for authority.
6. Asynchronous processor: `uploaded -> quarantined -> scanning -> approved -> extracting -> redacting -> indexing -> ready`; failure states `rejected`, `failed`, `revoked`, `deleted`. Persist per-step attempt count, last error code and idempotency key in the DB. Use bounded retries and DLQ, with reconciler for interrupted processing.
7. Extraction: PDF/DOCX/PPTX/XLSX/CSV/TXT; use OCR only where appropriate. Detect document language, grade, subject, topic and curriculum; treat source content as untrusted instructions. Encrypt or segregate sensitive derived text and embeddings. Store canonical source version and chunk offsets for citation.
8. Retrieval: require a verified `tenant_id`, class enrolment/resource entitlements, user role and consent at search time; apply identical authorisation again before presenting cited source documents. Deny ambiguous ownership. No cross-tenant fallback. Answer with source references, uncertainty and educator review for consequential outcomes.
9. Deletion or consent withdrawal must tombstone the file immediately for reads and retrieval, then asynchronously remove object versions, extracted text, embeddings, caches and export copies. Record completion in auditable retention events.
10. Start with RAG against approved material using existing Groq/Hugging Face inference. Do not send child personal records to external model providers without a documented legal basis, provider agreements and explicit approved processing policy. Model fine-tuning requires a separate curated, lawful, de-identified dataset and evaluation programme.

## Minimum security and quality gates
- Anonymous, foreign tenant, foreign classroom, revoked consent, expired intent and replayed intent all fail closed.
- A successful upload is not AI-readable until scan and explicit permission checks pass.
- Malicious/oversized/zip-bomb/file-spoofed inputs fail without storing searchable content.
- Prompt injections inside documents never become system or developer instructions.
- Re-index on source update; delete old version chunks and verify no stale retrieval.
- Test duplicate jobs, partial failures, idempotent retries, DLQ and reconciliation.
- Validate 10+ representative multilingual, curriculum-aligned answers against teacher-reviewed ground truth with measured citation precision and hallucination rate.
- Trace cost, throughput and latency without logging raw learner records or model prompts containing personal data.
- Do not merge/deploy until typecheck, storage integration, tenant isolation, security and migration checks pass.

## Release / rollback
- Feature flags: `CABO_R2_STORAGE_ENABLED=false`, `CABO_RAG_INGESTION_ENABLED=false` by default.
- Rollout: synthetic dev -> isolated staging -> opt-in institution pilot -> wider rollout after privacy review.
- Rollback: disable new uploads/ingestion; preserve original object metadata and existing Upstash/Replit readers; do not delete existing objects or flip historic paths.
- R2 account activation, keys, lifecycle, actual bucket names and production cutover require a separate approved change. No secrets in GitHub.
