# AI and RAG engineering status

## Current implementation boundary

The RAG lexical foundation is being delivered in the dependent work on `feat/rag-lexical-retrieval-foundation-20261113` (PR #181), which itself depends on the private-object staging and budget controls in PR #165. It chunks approved material deterministically, indexes PostgreSQL full-text vectors, and filters retrieval by authenticated owner, approved object state, AI-reading consent, deletion status, and current material/object linkage. The feature is disabled unless `CABO_RAG_LEXICAL_ENABLED=true`.

This is not yet an end-to-end tutoring RAG system: do not infer that retrieval is connected to learner chat, that embeddings/vector search exist, or that citations are shown in a learner interface. The tests below evaluate lexical retrieval only. Prompt-injection defenses at a future generation boundary, production ingestion wiring, latency/cost telemetry, and broader curriculum evaluation remain separate work.

## Reproducible lexical evaluation

Run from the repository root after `pnpm install --frozen-lockfile`:

```sh
node --test artifacts/api-server/src/tests/ragQualityEvaluation.test.mjs
node --test artifacts/api-server/src/tests/ragLexical.test.mjs
```

The quality test creates a temporary PGlite database and uses synthetic, non-personal educational passages. It indexes three known topics (photosynthesis, evaporation, fractions), issues one gold query per topic, then calculates Hit@3 and mean reciprocal rank (MRR). It requires Hit@3 >= 0.9 and MRR >= 0.8. It also verifies that an unrelated principal gets no results for the same material. The test does not call a hosted AI provider, require credentials, or access production data.

These are deliberately small regression thresholds for a deterministic lexical baseline, not evidence of curriculum-wide quality. Expand the gold set with curriculum-reviewed synthetic or licensed examples before claiming broader coverage; report Hit@k, MRR, tenant/consent negative checks, and test corpus version with each evaluation. Never put real learner records into this suite or external AI evaluation.

## Integration and safety requirements

- Derive owner identity from the authenticated server session; never accept a client-supplied owner/tenant identity as authorization.
- Keep retrieved text untrusted. A future generation prompt must explicitly treat retrieved content as data, delimit it, and reject instructions embedded in source material.
- Preserve source version, offsets and content hash so citations can be validated against the indexed document before display.
- Fail closed when indexing/retrieval is disabled, consent is absent/revoked, an object is not approved, or the material no longer points to the indexed object.
- Keep provider failures visible through structured telemetry and user-safe errors; do not silently substitute fabricated content.
- Before enabling outside isolated tests, review the staged database migration, backup/rollback, retention, POPIA/Botswana data protection implications, and tenant-isolation test evidence.
