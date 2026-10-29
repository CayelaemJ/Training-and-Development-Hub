# CABO Learning Hub — six production infrastructure gates

Reviewed against the actual Express/React monorepo on 29 October 2026. **Implemented code is not the same as independently verified production acceptance.** No new third-party accounts or paid features are required for this PR.

| Layer | Evidence in repo | Remaining production gate |
|---|---|---|
| Authentication and authorization | OpenID Connect browser login with PKCE, server-side sessions in PostgreSQL; native device PKCE and bearer sessions; organization/role-scoped API checks; restricted isolated demo logins | Replace Replit-default issuer/REPL_ID dependency with the approved production identity provider; enforce phishing-resistant/strong MFA for privileged users; recent-MFA step-up for administrative actions; verify school-, district- and guardian-scoped IDOR/access tests, server-side role revocation, session rotation/logout and encrypted token retention |
| Backend and APIs | Node.js, Express 5, PostgreSQL + Drizzle, Upstash Redis shared limiter, QStash signed webhook routes | Production SLOs, query budgets, contract testing, idempotent outbox, retry and dead-letter recovery. Do not add another application server framework without a specific requirement |
| Web/native clients | React/Vite web app, native Android/iOS/Windows work in separate app folders | Production-device acceptance and offline consistency, accessibility, parental consent, crash handling |
| Private object storage | Official \`@upstash/blob\` adapter with owner-scoped paths, read-time signed private URL; currently feature gated off on pilot | Child/guardian cross-border privacy review and processor contracts; malware/quarantine, orphan cleanup, actual-bucket quota reconciliation, retention/deletion SLAs and two-account E2E |
| Email/push/SMS | No complete delivery adapter verified in API library or routes | Implement server-side transactional email provider for verification/welcome/reset/consent, templates, opt-in/out and delivery logs; FCM/APNs for push; SMS only if necessary with consent and cost caps. Do not send student data to QStash or notification vendor message payloads |
| Monitoring and alerts | Pino HTTP logger, Render logs, \`/api/healthz\` and DB/Redis \`/api/readyz\`, QStash DLQ | Centralize sanitized error boundary and low-cardinality request logs (this PR); add tested free-tier Sentry or comparable alert integration, retention controls, redaction and error budget; set alerts for elevated 5xx, stalled jobs, low quota, backup failures and availability. Log no learner PII or confidential prompts |

## Identity: non-negotiable before schools

Current browser OIDC defaults to \`https://replit.com/oidc\` and uses \`REPL_ID\`. This is an implementation dependency rather than proof that a supported production identity provider has been selected. Native PKCE alone does not imply MFA. Server-side role resolution is already present, but every sensitive route and user transfer needs an independent cross-school/guardian authorization test.

**First production identity tasks:** choose an approved provider and test cross-device identity linking; migrate issuer without silently invalidating users; require MFA on superadmins/school admins, recent-auth step-up for administrative changes, and test session revocation across the web and native devices. Do not copy or deploy old test passwords or keys.

## Notifications: implement transport, not just UI

Choose a dedicated transactional email sender (e.g. Resend/Postmark/SendGrid) under a verified domain. Keep API tokens in Render secrets, enforce recipient validation, send rate-limits, idempotency, consent and template versioning, and store only minimal delivery metadata. Email bodies must contain no birth certificates, grades, personal IDs or payment documents. Use verified private links when a recipient must access their own data. Mobile push can use FCM/APNs once app identities and device-token rotation are tested. Avoid SMS until there is a compelling use case and predictable budget.

## Observability: this PR's limited scope

This PR changes \`app.ts\` logging to record allowlisted **route groups** rather than raw URLs, preventing document/learner IDs and query strings from being included in basic request telemetry. Unhandled errors are recorded with an opaque request reference, method, allowlisted route category, generic error type and status only; API responses do not include exception text or stack. Previous explicit JSON/body-size error responses remain unchanged.

This is **not Sentry, distributed tracing, synthetic uptime checks or alert delivery**. Application-specific \`req.log.error({err})\` calls require a separate security sweep before assuming all logs are sanitized. Do not enable analytics or crash SDK auto-capture of sensitive request bodies, headers, text inputs or child data.

## Cost and release controls

- Render pilot remains on existing service. No extra worker/service is created.
- Neon CABO org is currently on **Launch**; two compute endpoints were last observed configured as always-on (max 8 CU). Resolve actual usage and branch dependencies before modifying capacity.
- Upstash free Redis, private Blob and QStash are existing providers; never assume a free tier means zero exposure or unlimited requests.
- Before merging: CI verification, security suite, TypeScript/build, unit tests, and review telemetry output with a synthetic learner/guardian request.
- Before deploying production: branch-specific pilot CI, real Render HTTP 5xx smoke using a **synthetic** controlled route, validate no private identifiers in logs, and confirm fallback/rollback.
- Do not put API tokens, learner records, private signed URLs or native auth bearer tokens into error telemetry.

Related: launch tracker #102, storage #107, cost/queue #122.
