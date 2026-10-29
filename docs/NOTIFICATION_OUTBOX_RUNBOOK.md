# CABO Learning Hub — durable, encrypted notification outbox

## Status

**Review branch only.** The queue is not installed in the live database, not exposed through HTTP, not scheduled, and all feature flags are OFF. No real email is sent and no new provider or paid server is provisioned.

This is a deliberately conservative delivery ledger, **not** an automatic retry service. Its primary purpose is to prevent lost notification intentions, duplicate sends and unsafe retries when contacting guardians or learners.

## Storage and privacy

The additive database migration is \`lib/db/migrations/20261029_notification_outbox.sql\`. It creates an outbox with event UUID, recipient user reference, optional organization, allowlisted generic event kind, encrypted address, state, attempts, lease token, timestamp and sanitized error code.

- Recipient email is encrypted using AES-256-GCM with a **new random 96-bit nonce per event** and event UUID bound into authenticated associated data. No recipient email appears in logs, queue identifiers or the Redis dedupe key. The encryption key is never committed.
- Store the exactly 32-byte **base64** encryption key in the server-only \`CABO_NOTIFICATION_OUTBOX_KEY\` secret. Key loss makes queued addresses unrecoverable; back up and rotate according to an approved procedure. The app does not implement online key rotation yet.
- Only a trusted internal caller may invoke \`enqueueApprovedNotice\`. It must verify session, tenant, guardian eligibility, consent, recipient ownership and event creation first. There is **no public send/enqueue route**.
- An event UUID can be queued only once. \`queued -> leased -> sent | needs_review\`, and expired leases are **quarantined**, not silently replayed. \`needs_review\` requires manual provider reconciliation.
- The worker claims the oldest queued event with \`SELECT ... FOR UPDATE SKIP LOCKED\` in a transaction, releases the DB lock before making a provider request, then stores a status using its unique lease token.

## Controlled activation (synthetic data only)

1. Review and approve the additive SQL migration on a **separate synthetic test database** first. The current code does **not** execute any DDL.
2. Confirm the verified sending domain and provider account, transactional templates, Redis quota, retention, POPIA/Botswana lawful basis, minimum recipient data and withdrawal policy.
3. Run a complete synthetic sender test with \`CABO_TRANSACTIONAL_EMAIL_ENABLED=true\`, \`RESEND_API_KEY\`, \`CABO_FROM_EMAIL\`, \`UPSTASH_REDIS_REST_URL\`, \`UPSTASH_REDIS_REST_TOKEN\`.
4. Enable \`CABO_NOTIFICATION_OUTBOX_ENABLED=true\` and set the server-side \`CABO_NOTIFICATION_OUTBOX_KEY\`. **Do not enable on the pilot before a real authorized event producer exists and has been tested**.
5. For operational validation only, inspect and quarantine expired leases with the explicit CLI below. **It will not send** until a trusted, continuously revalidated recipient/guardian consent authorizer is implemented and wired to the worker:
   \`\`\`bash
   pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/src/scripts/processNotificationOutbox.ts
   \`\`\`
   This command currently performs no dispatch; it can only quarantine expired leases when explicitly enabled. It is **not** a cron service.
6. Implement the required server-trusted `DispatchAuthorization` callback; it must check current institution/guardian permissions, notification preferences, account state and consent immediately before delivery. Verify data remains organization-scoped and masked in logs, provider statuses reconcile, unknown responses enter \`needs_review\`, and all consent revocations cancel pending notifications.

## Remaining production blockers

- Server-side recipient/tenant/guardian authorization **must be reverified at dispatch time**, in addition to enqueue-time approval. The code now **requires** a trusted `DispatchAuthorization` callback and refuses to dispatch without one. The CLI intentionally has no authorizer, so it cannot send.
- Define queue retention and secure delete/subject erasure, encryption key rotation and backup/restore; avoid storing unnecessary relationship information.
- Audit/recovery UI for staff to reconcile provider delivery receipts, bounced addresses, duplicate notifications and events requiring manual review.
- Provider webhooks (signature-verified), delivery/failure/abuse alerts, allowlists and continuous cost monitoring.
- End-to-end CI test against a **synthetic** Postgres database with two workers and two organizations. Cryptographic unit tests cannot prove SQL locking or real provider delivery.
- No auto-retry: safe replay requires provider-specific verified idempotency and a separate signed reconciliation workflow. The existing Redis reservation preserves dedupe even after an uncertain provider result.
- Strong test of consent/guardian rules for minors, email opt-outs and account transfers before enabling any production delivery.

## Rollback

Keep \`CABO_NOTIFICATION_OUTBOX_WORKER_ENABLED\` false to block all dispatch. Keep \`CABO_NOTIFICATION_OUTBOX_ENABLED\` false to block new queue entries. Preserve old encrypted queue rows and encryption key for approved retention/recovery; do not run a destructive rollback without explicit approval.

See issues #127 (notifications), #126 (identity/MFA), #102 (launch readiness).
