# CABO AI and RAG quality evaluation

## Audit findings (main baseline reviewed 14 November 2026)

The API server already has a Groq-first/OpenAI-compatible completion adapter, bounded provider scheduling/quota handling, retry classification, and privacy-conscious AI inference metrics. Assessment and education routes use this adapter. The inspected backend tree does not contain a document ingestion/embedding/vector retrieval pipeline or a dedicated tutoring/RAG API. Existing MLOps evaluation is for assessment marking, not retrieval. Therefore RAG evaluation must not be presented as evidence that production retrieval exists.

## Reproducible offline benchmark

`data/rag-eval.synthetic.json` is a synthetic fixture; it contains no learner records or source text. Evaluate an exported retrieval run without sending it to a provider:

```sh
node --test artifacts/api-server/src/lib/ragEvaluation.test.mjs
```

Import `evaluateRetrieval(cases, options)` from `artifacts/api-server/src/lib/ragEvaluation.mjs` to evaluate a human-labeled run. Inputs include a query's expected document IDs, the authorized tenant ID, and ordered retrieval IDs with tenant IDs and optional citation flags. Keep query text and passages outside telemetry.

Metrics: recall@k, mean reciprocal rank@k, duplicate rate, citation coverage where citation annotations are provided, retrieved count, and a hard tenant-leakage count. Defaults: k=5, minimum recall 0.8, max duplicate rate 0.1. Any cross-tenant result fails the run. Empty/unlabeled result sets cannot silently pass. This utility intentionally does not calculate embedding latency, token use, cost, or answer groundedness because it does not execute an embedding or generation pipeline.

## API and platform contract

Web, Android, iOS, and Windows clients must call authenticated backend APIs; provider credentials must never ship to clients. Existing API routes are mounted through `artifacts/api-server/src/routes/index.ts`; AI-backed assessment endpoints remain the available generation interfaces. There is no verified public RAG ingestion/query endpoint in the audited route set. Do not build clients against an assumed `/rag` endpoint. Before adding one, require authenticated object-level authorization, server-derived tenant scope, file validation/size bounds, tenant-scoped retrieval filters, citation IDs, rate limits, prompt-injection isolation, and bounded data minimization. Error responses must distinguish provider unavailability from successful deterministic templates.

## Limitations and next gates

This is an offline retrieval-metric harness, not a production RAG implementation or deployment evaluation. A production gate requires a real pipeline, separately held-out human-labeled examples, retrieval trace export with identifiers pseudonymized, approved source licensing, and privacy/security review. Never use automated suggestions as diagnoses or high-stakes learner decisions; educators retain review responsibility.
