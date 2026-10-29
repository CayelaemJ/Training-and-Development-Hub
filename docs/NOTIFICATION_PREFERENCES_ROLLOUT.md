# CABO notification preferences — release checklist

This phase adds an authenticated, accessible page at \`/notification-preferences\` plus server-side \`GET /api/notifications/preferences\` and \`PATCH /api/notifications/preferences/:orgId/:kind\`.

**Everything is disabled by default** via \`CABO_NOTIFICATION_PREFERENCES_ENABLED\`; the page explains that rollout is pending rather than making ineffective promises. The separate \`CABO_NOTIFICATION_PREFERENCES_OPT_IN_ENABLED\` switch controls new consent grants. No actual emails or jobs are activated by either flag.

## Allowed actions and trustworthy evidence

- The authenticated account sees only school notification categories supported by its **current** school membership and educator assignment, or a **verified** guardian relationship with current active learner enrollment and the latest school-specific guardian decision equal to \`verified\`. Pending/accepted guardian invitations are not sufficient. Learners do **not** receive a self-consent opt-in flow from this interface, because CABO does not establish legal adult status merely from an account ID.
- Guardian notices are scoped to the actual school and the \`guardian_review_requested\` category. Assigned teachers/assessors only get \`learner_support_updated\`. Admin privileges do not automatically confer guardian email permissions.
- Every new opt-in requires a recent validated OIDC MFA claim (\`amr=mfa\`, \`auth_time\` within 10 minutes), \`email_verified=true\` obtained from a cryptographically validated OIDC ID token, the same current email stored in the account, and an explicit acceptance checkbox. No test-login/native session or browser-provided verified flag can meet this gate.
- **Opt-out remains available** for the account's existing record even when school membership or guardianship has since been removed; it does not require recent MFA. A user can withdraw consent even if the institution revoked their access. The optional feature gate still needs to be on, so opt-out UI is not presented before the audited migration is installed.
- Opt-in/out are audited using an append-only \`notification_preference_events\` row committed together with the actual preference change. The log contains user ID, organization ID, message kind and action, but **no email, content or child's personal details**.
- Existing outbox dispatch still rechecks the source record, consent and account email at send time, even after an opt-in was recorded.

## Database migrations — not applied

Apply *only after* approved privacy assessment, backups and synthetic multi-tenant testing, in order:
1. \`20261029_notification_outbox.sql\`
2. \`20261029_notification_consent.sql\`
3. \`20261029_notification_preference_audit.sql\`

None of these migrations are automatically run by this PR; all flags stay off. The live Neon database was previously checked and did not have these tables.

## Security, privacy, and launch blockers

1. Finish OIDC migration away from the Replit-default issuer, including trusted \`email_verified\` and recent provider MFA claims, session revocation, account recovery and 2-school access checks.
2. Verify educator assignments and guardian review history using synthetic two-institution/guardian fixtures; test future-dated consent, withdrawn consent, lost school membership, transfer, duplicate requests, and multiple devices.
3. Validate webhook/sender domain and account-specific free-tier budget. **Sending remains off** until recipient authorization, guardian consent and outbox delivery receipt reconciliation work end to end.
4. Consent recording must be shown only to legally authorized adults; do not infer legal age from a username. Guardian decisions need human-reviewed school evidence, and teacher/staff authorization must be revocable.
5. Approve POPIA/Botswana notice and consent wording, current processing basis, erasure/retention and transfer subprocessors. Audit log is a regulated record and requires defined retention.
6. Run TypeScript/build/security checks, inspect UI on mobile and desktop against existing CABO design, then port to the pilot branch and validate its Render deployment.
7. Keep the feature gated off until the migrations and provider assurance are approved. Do not enable just to make the demo appear functional; the app's education flows are independent of email.

This implements **preference UI and safe authorization**, not operational learner/guardian notification delivery. Related issues #126 (identity), #127 (notifications), #102 (launch).
