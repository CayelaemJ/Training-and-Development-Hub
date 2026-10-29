# CABO transactional notifications — opt-in provider adapter

The code in \`artifacts/api-server/src/lib/transactionalNotices.ts\` is an **internal-only** primitive. It has **no public send endpoint**, no event hooks, no deployed sending credentials, and does not send any email unless a trusted server caller opts in and the full deployment configuration exists.

## Supported notices (generic by design)
- \`guardian_review_requested\`: directs an approved adult to log in and review a request.
- \`learner_support_updated\`: directs an approved recipient to their authenticated learning support inbox.
- \`account_security\`: directs an approved account owner to the login portal.

Subjects and bodies contain no learner name, ID number, exam grade, school, birth certificate, payment information, recipient email, document URL, student question, or one-time credential. A caller must verify recipient ownership, lawful purpose and delivery consent and supply \`deliveryApproved=true\`. Do **not** let a public API caller choose arbitrary recipient addresses or set this flag.

## Server-only secrets / activation
- \`CABO_TRANSACTIONAL_EMAIL_ENABLED=true\` **only after** sender-domain verification, signed notification event wiring, and a real end-to-end consent/guardian test.
- \`RESEND_API_KEY\` — Resend API key, scoped to sending, stored only in Render secret/environment.
- \`CABO_FROM_EMAIL\` — verified sender domain and mailbox.
- \`UPSTASH_REDIS_REST_URL\`, \`UPSTASH_REDIS_REST_TOKEN\` — existing server-only Upstash Redis; no unprotected fallback allowed.
- \`CABO_REDIS_PREFIX\` — existing, isolated deployment prefix.

The module never sends if incomplete/disabled. It reserves send allowance using **atomic Redis EVAL**, at **75/day and 1,500/month** (below Resend's advertised free allocation of 100/day and 3,000/month). Reservations are keyed by SHA256 of a stable event UUID and recipient (no raw address in Redis key). Provider \`Idempotency-Key\` is also derived from the hash. A duplicate event is not sent again.

These are infrastructure controls, **not a full account-wide spending guarantee**. Other clients of the same Resend account can consume the vendor quota; a paid provider plan could have overages; app-side counters do not track every account-wide email. Stay on a verified Free tier with billing safeguards.

## Crucial unsolved production work

1. The adapter is intentionally **not connected** to real user, guardian, ticket or admissions actions. Build consent/guardian-aware event producers and server-side membership checks before using it.
2. Build a durable PostgreSQL outbox with job/recipient/event ownership, delivery states, retries, dead-letter alerts and duplicate-safe transaction boundaries. The present conservative reservation retains quota after a provider error and does not retry automatically, to avoid unintended duplicate emails or charges. **Do not claim guaranteed delivery** from this adapter.
3. Configure verified domain DNS (SPF/DKIM/DMARC), unsubscribe/notification preferences, age-appropriate recipient policy, country processor terms and POPIA/Botswana legal review.
4. Run synthetic approved-recipient messages and tests for bounced addresses, deleted/transfer accounts, opt-outs, malicious input, rate limits, failed Redis and email provider, exactly-once semantics and monitoring.
5. Add native FCM/APNs push separately with device-binding and consent review. SMS stays unimplemented, default off and budget-gated.

No vendor account or paid plan was created by this work. This is a **ready-to-integrate adapter**, not activated notifications. Tracks issue #127.
