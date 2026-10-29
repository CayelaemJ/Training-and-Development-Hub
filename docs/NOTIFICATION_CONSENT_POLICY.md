# CABO Learning Hub — notification policy and event provenance

## What this phase changes
The existing disabled encrypted outbox has an **additive, review-only** consent migration (\`lib/db/migrations/20261029_notification_consent.sql\`) and a typed event provenance link. The sender now needs to prove **which school-specific record justifies a notification**; a generic email address, guardian invitation or previous consent cannot authorize delivery.

The new \`notification_preferences\` table is per **recipient + school + notification kind**, defaults to **not opted in**, and requires confirmation timestamp and no revocation. This is a narrowly scoped email-preference record, not an identity document. The \`notification_event_sources\` table binds an event UUID to an actual support ticket or verified guardian relationship, atomically with the encrypted outbox row.

## Trusted recipient checks — at enqueue AND at dispatch
1. Current email must equal the authenticated account's stored email (case-insensitive); a stale or attacker-controlled address fails.
2. Explicit preference for the same school and event kind must be opted in, confirmed and not revoked; missing rows and future/invalid evidence fail closed.
3. A \`guardian_review_requested\` notice requires the **same school** to have an active enrolment for the learner, the guardian relationship to be verified, and its latest school-specific verification decision to be \`verified\`. A pending/accepted invitation alone cannot grant this eligibility.
4. \`learner_support_updated\` requires the exact support ticket and organization. Learners must currently be enrolled in the school and in the relevant course; teachers/assessors must hold a current school role and a course-staff assignment.
5. \`account_security\` is explicitly denied by this source-based pipeline. Those notices belong to a separately authenticated identity-provider process, not a school support ticket.
6. Guardian or staff role removal, school transfer, consent withdrawal, deleted account, changed email or missing event source all block dispatch.

The existing outbox adapter checks current eligibility before creating an event and persists its source link in one DB transaction. At dispatch, it decrypts the protected recipient and passes the email to a trusted current authorization callback. **A callback that always returns true is not acceptable.** The bundled manual CLI still supplies no callback and therefore cannot dispatch messages.

## Explicit activation requirements

- **Not applied:** Neither the original outbox migration nor this new migration has been run against Neon. Do not apply live DDL without review, backups and an approved rollback plan.
- **Not wired:** Learner-support and guardian routes do not emit email events. Create authorized, idempotent producers as part of the same business transaction *after* school/guardian consent and legal review, and add delivery-preference UI with age-appropriate guardian controls. A notification must never delay/rollback a learner's education ticket because the email provider is unavailable.
- **Not enabled:** All outbox and Resend flags stay off. No email account, sender domain, secret or schedule is configured by this PR.
- Before enabling: verify the full school/guardian consent policy, account-transfer boundaries, notification preferences and cancellation, domestic/cross-border processor agreements, retention and encrypted-queue deletion, key rotation and audit capability.
- Add synthetic two-school, two-guardian, teacher assignment/revocation, learner transfer and concurrent-worker database tests. The included pure policy tests verify business decisions but not live SQL permissions.
- No admin/self-service endpoint currently exists for changing preferences; create an authenticated, auditable consent flow, with verified guardians for minors, before inserting opted-in records.

## Release and rollback

Merge only after TypeScript/build, Semgrep, Snyk, secrets checks, CircleCI verify/security and policy tests. Keep the source and preferences tables uncreated until database review. No live transport change, new paid resource, learner document or queue entry is introduced in this phase.

Reverting this code does not remove tables or user consent; treat DB and consent rollback as a separate data governance change. Related launch issues #127 and #102.
