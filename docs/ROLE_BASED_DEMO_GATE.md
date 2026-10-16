# CABO Isolated Multi-Role Demo — Release Gate

## Accounts
The demo seeder uses **only** the configured `CABO_TEST_USERS_JSON` identities and their existing salted password hashes. It does not invent credentials or expose passwords. Synthetic per-stage role assignments prefer a test username containing `preprimary`, `primary`, or `highschool`. For accounts without stage suffix, the fallback is **primary only** to avoid unintended cross-school access.

Roles:
- `cabo_headmaster_*`: joins a fictional school as owner, permitted to view school reports.
- `cabo_teacher_*`: joins as teacher, *not* permitted school-wide confidential reporting by default.
- `cabo_learner_*`: joins as learner; matching 2026 enrollment, published mock grades and attendance are created for learner's own report view.
- `cabo_parent_*`: receives a pending guardian invitation. **Pending does not grant access** to child report cards or other sensitive records.

Demo initialization is idempotent, synthetic and locked to Railway `testing` with `ENABLE_CABO_DEMO_SEED=true`. Run via authenticated superadmin `POST /api/platform/demo/seed`. The protected `GET /api/platform/demo/status` confirms three seeded schools and their record counts.

## Presentation verification
1. Load demo data as superadmin; verify seeded learner, marks, attendance and fictional university counts.
2. Sign out. Log in as headmaster, open assigned school and confirm that its report-card preview loads while other schools are forbidden.
3. Sign out. Log in as teacher and verify read/write operations only within assigned teaching scope and that private school-wide reports are forbidden.
4. Sign out. Log in as learner and load `/api/reports/me?organizationId=<assigned_school_id>&year=2026`. Confirm published marks and attendance for this learner, with **Draft preview** watermark.
5. Sign out. Log in as parent and verify incoming guardian invitation remains pending and cannot reveal any child records.
6. Confirm unauthenticated requests to private endpoints reject access; confirm secondary-school and university application demo data never claims actual institutional integration.

## Not yet signed off
- Automated authenticated browser coverage for independently logged-in accounts.
- Formal adult guardian verification and child-scoped access grant.
- Production-grade school onboarding, school transfers, report issuance, signed credentials and university partner APIs.
- Real-time notifications, offline attendance, QR check-in and full timetable optimisation.
- Official provincial/district hierarchy integrations and POPIA legal/security sign-off.

Do not promote this acceptance scenario to production or claim nationwide operational readiness without evidence.
