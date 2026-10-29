# CABO Learning Hub — Cloudflare Django insights Worker (staging)

This is a **narrow, opt-in processing service**, not a replacement for the CABO Express API, its PostgreSQL database, permissions, exam grading or AI-provider orchestration. Cloudflare Python Workers support Django WSGI as of September 2026. The Django service uses no separate learner database or persistent model state.

## Scope
- `POST /v1/insights/draft`: validates **coded, aggregate-only** learning metrics and returns deterministic, advisory intervention labels. Never use output as final assessment, progression, diagnosis or automatic learner decisions.
- `GET /health`: safe service liveness.
- Strict schema allowlisting rejects personal-data fields such as names, emails, learner IDs, essay answers and documents. Short machine-readable concept codes still require upstream review to prevent accidental identifying labels. The worker must not receive children's personal records.
- Bearer authentication is mandatory. Only the existing signed-in CABO API can proxy input; the browser must never receive the Worker token.
- This is synchronous stateless processing. Cloudflare Queues/R2 should be added only when durable completion status, consumer idempotency, consent revocation and rollback have been implemented and tested.

## Local and deployment
From this folder with Python 3.12+, uv and workers-py/Pywrangler installed:
```sh
uv run python -m django test --settings=cabo_worker.settings
uvx --from workers-py pywrangler dev
```
Set strong random values for `DJANGO_WORKER_TOKEN` and `DJANGO_SECRET_KEY` using Cloudflare Worker **secret** bindings (never use test values):
```sh
uvx --from workers-py pywrangler secret put DJANGO_WORKER_TOKEN
uvx --from workers-py pywrangler secret put DJANGO_SECRET_KEY
uvx --from workers-py pywrangler deploy
```
The `DJANGO_ALLOWED_HOST` Wrangler variable is restricted to the verified `cabo-learning-django-insights.cabo-solutions-za.workers.dev` hostname. Change it only when the Cloudflare account/route changes and re-test hostile Host headers.

Confirm the deployed Worker URL and authorized health+POST smoke tests first; do not configure a custom public route until security review. Avoid logging inputs, token material or learner data.

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

## Provisioned Cloudflare staging queues (29 October 2026)

The connected Cloudflare account now has two **EU-jurisdiction** queues:
- `cabo-learning-insights-staging` (queue ID `e555b6ce71b043d388bbb00b1a9935bb`)
- `cabo-learning-insights-staging-dlq` (queue ID `b9019c0485ad4e3da11f026314f23f9e`)

**These queues are presently unbound, empty and inactive.** Do not publish messages until an authenticated producer, durable job-status store, idempotent consumer, failure classification, DLQ monitoring, consent/revocation checks and cross-border review are implemented. Cloudflare's Workers Free plan includes 10,000 queue operations/day with 24-hour retention, so it is unsuitable as the only durable job store.

### Expected staging verification
1. Django test suite: `python -m django test --settings=cabo_worker.settings`.
2. CircleCI `django_worker`, `verify`, `security_suite` must be green; an unrelated failure requires diagnosis, not bypass.
3. Pywrangler deployment with the exact Cloudflare hostname and *runtime* secrets.
4. Call `GET /health` (200), unauthenticated `POST /v1/insights/draft` (401), authenticated synthetic POST (200).
5. Enable the main API feature only in isolated staging; verify anonymous requests (401), disabled path (404), and unavailable worker handling (503).
6. Verify no PII reaches Cloudflare logs or queues and no existing academic marks are changed.
