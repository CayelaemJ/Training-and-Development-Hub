# CABO Learning Hub — Cloudflare Django insights Worker (staging)

This is a **narrow, opt-in processing service**, not a replacement for the CABO Express API, its PostgreSQL database, permissions, exam grading or AI-provider orchestration. Cloudflare Python Workers support Django WSGI as of September 2026. The Django service uses no separate learner database or persistent model state. The service has no browser session or CSRF middleware: a mandatory strong server-to-server bearer credential protects its POST endpoint.

## Scope
- `POST /v1/insights/draft`: validates **coded, aggregate-only** learning metrics and returns deterministic, advisory intervention labels. Never use output as final assessment, progression, diagnosis or automatic learner decisions.
- `GET /health`: safe service liveness.
- Strict schema allowlisting rejects personal-data fields such as names, emails, learner IDs, essay answers and documents. Short machine-readable concept codes still require upstream review to prevent accidental identifying labels. The worker must not receive children's personal records.
- Bearer authentication is mandatory. Only authorised institution managers on the signed-in CABO API can proxy input; the browser must never receive the Worker token.
- This is synchronous stateless processing. Cloudflare Queues/R2 should be added only when durable completion status, consumer idempotency, consent revocation and rollback have been implemented and tested.

## Local and deployment
From this folder with Python 3.12+, uv and workers-py/Pywrangler installed:
```sh
DJANGO_SECRET_KEY=local-only-test-secret DJANGO_WORKER_TOKEN=long-test-only-token-for-ci-tests-1234 uv run python -m django test --settings=cabo_worker.settings
uvx --from workers-py pywrangler dev
```
Deploy using `pywrangler` from an authenticated trusted environment, uploading fresh strong random `DJANGO_WORKER_TOKEN` and `DJANGO_SECRET_KEY` values as **Worker secrets in the same deployment** (never use local test values or commit credentials):
```sh
# Create a local, untracked JSON file with the two random keys.
# Use an account-scoped Cloudflare deployment identity.
uvx --from workers-py pywrangler deploy --secrets-file /secure/path/staging-secrets.json
# Delete the temporary secrets file securely after deployment.
```
Cloudflare supports `--secrets-file` for atomic code/secret upload. Do not deploy the Python Worker without both secrets; its Django settings fail closed when the signing secret is absent. A previously attempted automated authenticated deploy was blocked by the connector's security checks; its temporary deployment credential was revoked. Deployment must be performed through an authorised trusted build workflow.
The `DJANGO_ALLOWED_HOST` Wrangler variable is restricted to the verified `cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev` hostname. Change it only when the Cloudflare account/route changes and re-test hostile Host headers.

Confirm the deployed Worker URL and authorized health+POST smoke tests first; do not configure a custom public route until security review. Avoid logging inputs, token material or learner data.

## Existing CABO API configuration
- `ENABLE_CABO_DJANGO_INSIGHTS=true` (defaults **off**)
- `CABO_ENVIRONMENT=staging` (or `testing`; **never** `production`)
- `CABO_DJANGO_STAGING_PRIVACY_APPROVED=true` only after synthetic-data and cross-border review
- `CABO_DJANGO_WORKER_URL=https://cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev` (server-side only)
- `CABO_DJANGO_WORKER_TOKEN=<same secret as Cloudflare>` (server-side only)

`POST /api/organizations/:orgId/learning/insights/draft` requires an authenticated CABO session and verified **owner/admin (or platform superadmin)** authorisation for that institution. Unscoped users and users belonging to other institutions are denied. It accepts `{"concepts":[{"code":"fractions","masteryPercent":45,"evidenceCount":5}]}` and returns advisory labels only. Metrics are supplied by the caller and are **not institution-verified**. This endpoint must not be used for real learner decisions until scoped source evidence and consent checks are implemented. An additional server-side staging-only guard prevents calls outside `CABO_ENVIRONMENT=staging` or `testing`, even when `ENABLE_CABO_DJANGO_INSIGHTS=true` is set in production. `CABO_DJANGO_STAGING_PRIVACY_APPROVED=true` must also be explicitly granted by the responsible pilot administrator; this flag is an authorisation gate, not proof that supplied data is synthetic.

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

### Cloudflare Python local-runtime verification
The pinned Wrangler `4.151.3` local `workerd` build supports compatibility date `2026-10-26` (not `2026-10-28`). The Worker configuration uses the supported date. A manual synthetic HTTP run under Cloudflare's local Pyodide/WSGI runtime confirmed: health 200, no/invalid bearer 401, authorised synthetic advisory 200, disallowed identifying fields 400 and forged Host 400. The local runtime took approximately 30 seconds to process its first request; subsequent requests completed in less than 0.1 seconds. This **does not predict hosted Cloudflare cold-start performance**, which requires separate verification.

After `uvx --from workers-py==1.17.9 pywrangler sync`, the repeatable local smoke script is `node scripts/test-django-worker-local.mjs` from the repository root. It uses only synthetic secrets and data and will refuse to replace an existing local `.dev.vars` file. It must pass in an isolated runtime before any hosted staging deployment is approved.

### Expected staging verification
1. Django test suite: `DJANGO_SECRET_KEY=local-only-test-secret DJANGO_WORKER_TOKEN=long-test-only-token-for-ci-tests-1234 python -m django test --settings=cabo_worker.settings`.
2. CircleCI `django_worker`, `verify`, `security_suite` must be green; an unrelated failure requires diagnosis, not bypass.
3. Pywrangler deployment with the exact Cloudflare hostname and *runtime* secrets.
4. Call `GET /health` (200), unauthenticated `POST /v1/insights/draft` (401), authenticated synthetic POST (200).
5. Enable the main API feature only in isolated staging; verify anonymous requests (401), non-manager/other-institution requests (403), disabled path (404), and unavailable worker handling (503).
6. Verify no PII reaches Cloudflare logs or queues and no existing academic marks are changed.

## Approved Cloudflare deployment via CircleCI (never automatic)
The repository includes a pipeline parameter `deploy_django_staging` (default `false`). It runs the Cloudflare deployment workflow **only when explicitly triggered against `main`**, and only after Django, repository and security-suite jobs pass. Set up a restricted CircleCI context named `cabo-cloudflare-staging` with:
- `CLOUDFLARE_ACCOUNT_ID` set to the verified CABO account ID.
- `CLOUDFLARE_API_TOKEN`: a short-lived or managed **account-scoped Workers Scripts deployment credential**, not a global API key.
- `DJANGO_SECRET_KEY`: strong randomly generated Django signing key, at least 32 characters.
- `DJANGO_WORKER_TOKEN`: strong random shared bearer secret, at least 32 characters, also configured in the **staging CABO API only**.
- `CABO_DJANGO_WORKER_URL=https://cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev`.
- `CABO_ENVIRONMENT=staging` and `CABO_DJANGO_STAGING_PRIVACY_APPROVED=true` (both required by the CI deploy preflight; do not add these approval flags to production).

Restrict context access to approved maintainers and staging jobs; do not use live student records. The job writes secrets to a temporary mode-0600 file, deploys via Pywrangler, deletes that file, then runs `node scripts/test-django-worker-staging.mjs` to check HTTP health, authentication, advisory output, and privacy rejection. A failed test is a failed release even if the Worker upload succeeded: revert staging before proceeding. **There is currently no authorised Cloudflare deployment credential configured in this connected environment, so this remains a prepared, untriggered workflow.**
