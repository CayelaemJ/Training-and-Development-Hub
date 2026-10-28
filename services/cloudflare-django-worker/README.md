# CABO Learning Hub — Cloudflare Django insights Worker (staging)

This is a **narrow, opt-in processing service**, not a replacement for the CABO Express API, its PostgreSQL database, permissions, exam grading or AI-provider orchestration. Cloudflare Python Workers support Django WSGI as of September 2026. The Django service uses no separate learner database or persistent model state.

## Scope
- `POST /v1/insights/draft`: validates **coded, aggregate-only** learning metrics and returns deterministic, advisory intervention labels. Never use output as final assessment, progression, diagnosis or automatic learner decisions.
- `GET /health`: safe service liveness.
- Strict allowlisting forbids names, emails, user IDs, essay answers, documents and free-text prompts. No children's personal records go to this worker.
- Bearer authentication is mandatory. Only the existing signed-in CABO API can proxy input; the browser must never receive the Worker token.
- This is synchronous stateless processing. Cloudflare Queues/R2 should be added only when durable completion status, consumer idempotency, consent revocation and rollback have been implemented and tested.

## Local and deployment
From this folder with Python 3.12+, uv and workers-py/Pywrangler installed:
```sh
uv run python -m django test --settings=cabo_worker.settings
uvx --from workers-py pywrangler dev
```
Set `DJANGO_WORKER_TOKEN` and `DJANGO_SECRET_KEY` via Cloudflare Worker **secret** bindings:
```sh
uvx --from workers-py pywrangler secret put DJANGO_WORKER_TOKEN
uvx --from workers-py pywrangler secret put DJANGO_SECRET_KEY
uvx --from workers-py pywrangler deploy
```
Confirm the deployed Worker URL and authorized health+POST smoke tests first; do not configure a public route until security review. Avoid logging inputs, token material or learner data.

## Existing CABO API configuration
- `ENABLE_CABO_DJANGO_INSIGHTS=true` (defaults **off**)
- `CABO_DJANGO_WORKER_URL=https://<verified-worker-host>` (server-side only)
- `CABO_DJANGO_WORKER_TOKEN=<same secret as Cloudflare>` (server-side only)

`POST /api/learning/insights/draft` requires an authenticated CABO session. It accepts `{"concepts":[{"code":"fractions","masteryPercent":45,"evidenceCount":5}]}` and returns advisory labels only. Metrics are supplied by the caller and are **not institution-verified**. This endpoint must not be used for real learner decisions until scoped source evidence and consent checks are implemented.

### Release gates
- Django unit tests, main CABO typecheck/build and security regressions.
- Anonymous, cross-tenant, mixed-age, oversized payload, malformed request, leakage and timeout tests.
- Only synthetic records in Cloudflare staging; evaluate cross-border POPIA/Botswana data obligations.
- Controlled rollout; leave existing academic routes and grading unchanged.
