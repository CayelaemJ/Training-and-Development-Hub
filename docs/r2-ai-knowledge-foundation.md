# CABO R2 storage and grounded AI ingestion: implementation contract

Status: **private R2 storage foundation + safety design; no learner-facing RAG yet**. The Cloudflare account is enabled and an isolated private-bucket synthetic PUT/GET/DELETE smoke test passed. The test object was removed. Upload routes are not wired to the new R2 budget ledger, the migration has not been applied, and no chunk index, embeddings, retrieval endpoint or production learner-data flow exists.

## Existing baseline (preserve)
- Express `/storage/uploads/request-url` and `/storage/uploads/blob/:id` provide authenticated upload intents and validate file size/type/signature.
- `privateBlob.ts` provides an 8 MiB pilot via Upstash with explicit privacy review approval.
- `objectStorage.ts` uses a Replit object-storage sidecar; Railway testing has a distinct fallback.
- `allowAiReading` already exists as an opt-in. Do not turn it on by default or bypass existing material access checks.
- The staging Django insights Worker is deliberately stateless and does not process raw child data; existing EU staging queues are not yet connected to a consumer.

## R2 rollout
1. R2 account activation is complete. Before enabling learner-facing use, finish privacy, data-residency and cost review. Use separate `dev`, `staging`, and `prod` environments.
2. Start with private **quarantine**, **approved-content**, and **temporary-exports** buckets. Create more buckets only for independently required lifecycle/retention policy. Logical categories (curriculum, classroom, assessments, learner records) are metadata/prefix classifications, not automatic public buckets.
3. Store object keys as random IDs under opaque prefixes. Never put learner names, emails, school names or untrusted filenames in keys. File records remain in PostgreSQL with `tenant_id`, `owner_id`, category, classification, size, checksum, content type, consent status, purpose, retention deadline, object version and processing state.
4. Keep the existing client contract intact. Add a disabled-by-default `CABO_STORAGE_PROVIDER=r2` selection and tenant-scoped server-side authorisation before issuing short-lived upload intents. For direct browser uploads, bind intent to expected key, maximum bytes, MIME, checksum and expiry; verify bytes at finalisation. Avoid public R2 URLs. Provide signed downloads only after a fresh object-level permission check.
5. Quarantine every new upload. Check verified signature, decompression limits, AV scan and approved file classification *before* promoting an immutable copy to approved storage. Queue processing after committed metadata state, with a durable outbox. Never trust webhook or queue payloads for authority.
6. Asynchronous processor: `uploaded -> quarantined -> scanning -> approved -> extracting -> redacting -> indexing -> ready`; failure states `rejected`, `failed`, `revoked`, `deleted`. Persist per-step attempt count, last error code and idempotency key in the DB. Use bounded retries and DLQ, with reconciler for interrupted processing.
7. Extraction: PDF/DOCX/PPTX/XLSX/CSV/TXT; use OCR only where appropriate. Detect document language, grade, subject, topic and curriculum; treat source content as untrusted instructions. Encrypt or segregate sensitive derived text and embeddings. Store canonical source version and chunk offsets for citation.
8. Retrieval: require a verified `tenant_id`, class enrolment/resource entitlements, user role and consent at search time; apply identical authorisation again before presenting cited source documents. Deny ambiguous ownership. No cross-tenant fallback. Answer with source references, uncertainty and educator review for consequential outcomes.
9. Deletion or consent withdrawal must tombstone the file immediately for reads and retrieval, then asynchronously remove object versions, extracted text, embeddings, caches and export copies. Record completion in auditable retention events.
10. Use Groq only for answer generation by default; Hugging Face and other providers stay disabled behind explicit feature flags. Do not send child personal records to external model providers without a documented legal basis, provider agreements and explicit approved processing policy. Model fine-tuning requires a separate curated, lawful, de-identified dataset and evaluation programme.

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


## Retrieval performance plan

The current application has material extraction and capped text windows for generating quizzes/exams, but no retrieval-augmented generation pipeline. Use this staged design to keep the first release fast and low-cost:

1. **Async ingestion:** retain upload signature/size checks, put new material in private quarantine, scan/approve it, then enqueue idempotent extraction/chunking through a durable outbox. Upload requests should not wait for extraction, OCR, embeddings or indexing.
2. **Cheap first retrieval:** begin with PostgreSQL full-text search over approved, consented, owner-scoped chunks. Keep chunk metadata (material version, source offsets/page, language, content hash) and add GIN text plus B-tree authorization filters. This avoids an embedding API cost for the first release.
3. **Bounded context:** retrieve 5–8 chunks max, deduplicate neighbors, enforce a measured prompt-token budget and pass source IDs/offsets. Validate model citations against the retrieved source IDs; repeat object and consent authorization before returning cited content.
4. **Optional vectors:** add pgvector only after teacher-reviewed evaluation and a usage budget are approved. Fix the embedding model and dimensions, batch requests, and key idempotency by model version + content hash so unchanged chunks are not re-embedded. Keep vector search inside the existing PostgreSQL instance; do not add a hosted vector database by default. Hugging Face feature extraction is a distinct embeddings task from chat completion. The current HF token returned 402 and has been cleared, so do not issue live embedding calls until a rotated token and available credit are confirmed.
5. **Hybrid/reranking only by evidence:** add vector + lexical fusion or a reranker only if the evaluation set shows a meaningful improvement in citation precision or recall at acceptable latency and cost.
6. **Performance gates:** on 10,000 synthetic chunks, staging SQL retrieval p95 <500 ms; max 8 context chunks; record ingestion duration, retrieval latency, token counts and provider failures without logging source text or learner records. Evaluate 10+ teacher-reviewed multilingual questions for answer grounding and citation precision; verify updates, deletion and consent withdrawal remove stale results.

A GIN index for lexical search and a filtered pgvector index are separate concerns. pgvector recommends measuring filter selectivity and iterative index scans for ANN queries, because metadata filters can reduce the returned result count after an index scan. Keep authorization predicates in SQL and benchmark recall under those filters before enabling approximate search.

## Release boundary
The first RAG release is limited to approved, owner-scoped learning material. Institution/class sharing requires verified tenant and enrolment authorization. Do not index learner profiles or emotional-support records, and do not send child personal records to external providers without a documented legal basis and approved safeguards.


## Implemented lexical foundation (13 November 2026)

The stacked branch `feat/rag-lexical-retrieval-foundation-20261113` adds the first retrieval code slice while keeping it disabled:

- `20261113_rag_lexical_foundation.sql` defines owner-scoped, versioned chunks with source offsets, content hashes, a multilingual-safe PostgreSQL `simple` text-search vector, a GIN search index and owner/material B-tree filters.
- `ragLexical.ts` provides deterministic paragraph-aware chunking, transactional replacement and a bounded top-eight lexical query.
- Index replacement is allowed only when PostgreSQL confirms the same owner, material/object relationship, R2 state `approved`, explicit R2 AI consent and material AI-reading consent. Retrieval repeats those checks in SQL.
- `CABO_RAG_LEXICAL_ENABLED` remains false unless explicitly set. No route, background worker, migration application, learner upload, embedding call or production deployment is included in this slice.
- Deleting a material or its R2 ledger row cascades its chunks. Re-indexing deletes the previous material version and inserts the new version in one transaction, preventing stale mixed versions.

Next dependency: the approved-content scan/promotion worker must call the index replacement function after a durable approval event. Only after that worker and its authorization checks exist should an authenticated retrieval/answer route be exposed.
