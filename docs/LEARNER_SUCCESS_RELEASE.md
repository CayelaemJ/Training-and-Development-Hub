# Learner Success Loop — staged release

## Implemented

- School- and course-scoped support requests, learner questions and attempted work.
- Full gated lifecycle: open, triaged, assigned, in progress, awaiting learner, follow-up required, resolved and closed. Reopening clears the current outcome snapshot; history remains.
- Authorised educator selection, replies, practice instructions and dated review checkpoints.
- Published baseline/follow-up result selection, matching subject and assessment category, educator comparability explanation, immutable result snapshot and percentage-point changes. This is observed progress, not causal attribution or automatic concept scoring.
- Learning DNA: educator-reviewed concept states with evidence. Demonstrated understanding requires a published comparison. Reopened evidence is marked for review. Concept labels are support labels, not yet a nationally validated curriculum map.
- Intervention Accountability Engine: database aggregate counts over all requests the viewer is permitted to see, overdue reviews, unassigned requests, learner feedback and measured outcomes. It does not rank teachers.
- Private account-bound Learner Passport, paginated history and JSON export without conversations, staff contact details or unreviewed narratives. Only support progress and DNA are included in this first passport extension; certificates, sports verification and formal cross-school record transfers remain separate release work.
- Report previews include minimal support/outcome summaries. Existing report and verified guardian authorisation gates apply. Already-issued frozen reports remain unchanged.
- Guided learning help: opt-in, minimal-topic AI drafts validated server-side, bounded provider-call deadlines and a labelled non-AI template during outages. No learner profile, conversation or raw support question is sent. A topic filter is defence in depth, not proof of de-identification. Enable external AI only after the school approves provider processing; never place personal details in topic labels.
- Country-neutral, append-only school framework versions: country code, curriculum identifier/version, grade labels, grading bands, BCP47 languages and IANA timezone. Botswana PSLE/JCE/BGCSE and other school frameworks can be labelled/configured. Existing support records retain their framework version.

Existing grade progression and national-administration modules still contain South African assumptions. This release does **not** implement official Botswana promotion/certification rules, automatic grading-band application to every legacy report, national curriculum validation or worldwide regulatory compliance. Configure and validate the school framework before a pilot. Language configuration does not translate the interface.

## API

All routes below require a session; school routes also require membership, with course staffing enforced for educators.

- GET/POST `/api/organizations/:orgId/support`
- GET `/api/organizations/:orgId/support/options`
- GET `/api/organizations/:orgId/support/accountability`
- GET `/api/organizations/:orgId/support/:ticketId`
- POST `/api/organizations/:orgId/support/:ticketId/actions`
- POST `/api/organizations/:orgId/support/:ticketId/guidance-draft`
- GET `/api/learner-passport/me?after=<cursor>&download=true`
- GET/POST `/api/organizations/:orgId/education-framework`
- GET `/api/readyz` — database/readiness check; `/api/healthz` is liveness only.

Creation uses a learner-bound UUID request key. Mutations require the latest version. Ticket changes and their audit events commit together. Audit records are append-only through the API; privileged database administrators can still alter the database.

## Rollout and migration

Default feature status is **off**. Apply the additive migration on a backed-up pilot database:

```sh
node lib/db/scripts/migrate-learner-support.mjs
```

The runner uses a transaction, advisory lock, short lock timeout and checksum ledger. Never use schema push for production. Then set `ENABLE_LEARNER_SUCCESS_LOOP=true`. `ENABLE_SUPPORT_AI` defaults off; without it guidance remains a non-AI template.

Rollback: disable both flags and redeploy the prior compatible application. Retain the additive tables and audit evidence; do not drop learner data as an automatic rollback.

## Scale and durability

- PostgreSQL is the source of truth; the browser retains no new learner records in local storage.
- Unique creation keys, optimistic version checks and atomic event writes protect retries and concurrent edits.
- Cursor pagination: 50 queue entries, 100 passport entries per request. Details cap displayed history at 500 and result/educator choices at 100. Report previews cap support summaries at 200. Full administrative audit export needs a separate paginated interface before large deployments.
- Aggregate accountability runs in the database rather than downloading every ticket.
- Indexed learner, school/status, assignment and event access paths.
- Pool bounded by `DB_POOL_MAX` (default 10, maximum 50), 5-second connect and 15-second statement timeouts. Budget all replicas against the database connection limit; use the provider's pooled URL when available.
- Graceful HTTP shutdown and pool drain; persistent sessions already live in PostgreSQL.
- UI refreshes every 30 seconds and after writes. This is polling, not instant push delivery.
- AI limiter/candidate health is not distributed. Shared quotas, durable notification outbox, queues, circuit breakers and worker retry/dead-letter processing remain required before horizontal AI rollout.
- National capacity is not established by these checks. Load tests, production Postgres concurrency, query-plan verification, restore drills and external security review remain release gates.

## Verification

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
node --test artifacts/api-server/src/tests/*.test.mjs
node scripts/test-learner-support.mjs
pnpm --filter @workspace/api-server run build
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/training-platform run build
```

The integration runner uses embedded PostgreSQL (PGlite) with synthetic HTTP test identities. It covers tenant isolation, course assignments, Botswana configuration permissions, UUID idempotency, conflicting updates, comparable published evidence, the 42→72 loop, closure acknowledgement, reopening, passport privacy, DNA and pagination. It does not test the real session-login flow, live AI or a production Postgres server.

A synthetic browser test is included at `scripts/verify-learner-success-browser.mjs`. The local browser runtime download failed in this execution environment, so browser, visual and mobile assertions were **not executed**. Do not report them as passing. Run with a local built SPA and `CABO_UI_TEST_URL`, after installing Playwright and Chromium. Real multi-account browser acceptance remains required before enabling the flag for real learners.

## Render migration

Use one Node service serving the API and compiled SPA from the same origin; preserve the existing external PostgreSQL database and blob-backed test uploads. This avoids a split-origin cookie/CORS migration. Build: `bash scripts/render-build.sh`; start: `bash scripts/render-start.sh`; HTTP readiness: `/api/readyz`.

- `NODE_ENV=production`, `NODE_VERSION=24`, `BASE_PATH=/`
- `FRONTEND_DIST_DIR=artifacts/training-platform/dist/public`
- `CABO_ENVIRONMENT=testing` for the isolated pilot (production must not enable test login or test superadmin)
- `DB_POOL_MAX=10`
- Keep `ENABLE_LEARNER_SUCCESS_LOOP=false` until migration and live role checks pass.
- Transfer the source service's DATABASE_URL, AI configuration and authorised test-login settings through the provider dashboards. The connected Railway OAuth API redacts values; no credentials are embedded in this repository.
- Set `APPLY_LEARNER_SUPPORT_MIGRATION=true` for a reviewed pilot release only, or apply the runner separately. The startup script otherwise never modifies schema.
- Render's exact `RENDER_EXTERNAL_URL` is trusted; extra custom domains go in `CABO_ALLOWED_ORIGINS`.
- Verify authentication, existing material downloads/uploads, AI and school data before redirecting traffic or removing Railway. Preserve Railway as rollback until these checks pass.

A free Render service is suitable for a limited pilot, not an always-on national rollout. Confirm compute, database locality, backups and budget before increasing usage. The switch to a different host alone does not establish performance or availability.

## Remaining flagship and later work

Real authentication/guardian browser tests, privacy/legal review, official curriculum concept registry, calibrated concept-level assessments, attachment scanning, reporting misconduct and safeguarding escalation, durable notifications, response-time targets, secure tutoring sessions, complete longitudinal/sports passport, verified transfer consent, translated/age-adaptive UI, full AI safety evaluations and restore/load testing remain outstanding. Do not claim the full master brief is complete.
