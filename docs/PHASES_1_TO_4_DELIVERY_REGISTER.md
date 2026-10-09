# CABO: Phases 1–4 Delivery Register — 8 October 2026

This file explicitly differentiates committed code from end-to-end validated functionality. A passing build is **not** proof of school, university, recruitment, psychometric or production readiness.

## Phase 1: Identity, permissions, platform reliability

**Implemented in the working branch**
- Separate institutional management-unit hierarchy, scoped role grants, role-based home dashboards and server-side academic course authorisations
- Isolated Railway PostgreSQL testing, guarded `cabo_test` superadmin, limited audit records, private learner ownership
- CI unit tests, typecheck and build
- Private model tables and default-off candidate/employer feature gates

**Not complete:** independent multi-user and cross-school E2E verification, production-grade authentication, formal registration/age checks, full rate limiting, tamper-resistant audit trails, versioned migrations, disaster recovery and penetration testing.

## Phase 2: School and university education operations

**Implemented**
- Institution-admin enrolment attestations, private learner journey and school transfer approval workflow
- Academic terms, subjects, assessments, grades, assignment moderation and linked written-exam workflows
- Daily attendance and school notices (new API/UI, scoped to authorised institution)
- Separate teacher/leader/student dashboards and course assignment rules

**Not complete:** actual certified South African school registration, admissions, timetables, degree requirements, fee/payment workflows, licensed curriculum content, physical attendance capture on teacher class rosters, parental notifications with legal guardian validation, certified transcripts and independent end-to-end audits.

## Phase 3: Careers, opportunities and lifelong portfolio

**Implemented**
- Existing opportunity listings, employer consent request prototype (disabled)
- New candidate-controlled job application model, endpoints and frontend
- Candidate-owned evidence and portable learner portfolio foundation
- Employer application review endpoint scoped to the organisation that posted the vacancy, without disclosing passport/psychological results

**Gated:** the application submission endpoint returns 503 unless `ENABLE_CAREER_APPLICATIONS_PILOT=true`. The pilot must remain disabled until age eligibility, employer verification, fraud handling, contracts and relevant child-protection safeguards are established.

**Not complete:** verified employer onboarding, graduate status, resumes/CVs, applicant communications, interviews, withdrawals, notifications, verification of professional credentials, retention/deletion and external ATS integrations.

## Phase 4: Evidence and psychometric passport

**Implemented**
- Private candidate-owned assessment/development metadata, provider, version, date and six-month review due date
- All user-submitted records clearly marked `unverified`
- Separate career/passport interface. No employer-readable passport endpoint and no raw psychological test answers in these tables.

**Not complete / cannot be treated as completed by coding alone**
- Real licensed or properly validated psychometric instrument, norm-referenced scores or interpretations
- Evidence supporting test validity/reliability and fairness across candidate populations
- Registered psychologists or suitably authorised practitioners and legal assessment governance
- Candidate identity verification, accessibility accommodations, test security, anti-cheating, professional result interpretation
- Consent-based sharing for role-relevant assessments, revocation, professional audit review, legal retention rules
- Employer acceptance pilots measuring predictive validity and selection fairness

Six months is a *development check-in schedule*. It is NOT necessarily an appropriate retesting frequency for a given psychological construct or licensed test. Never generate employment selection decisions or psychological diagnoses from self-reported development records.

## Isolated Railway test

Project: CABO Learner Hub - Isolated Test; environment `testing`.
App: https://cabo-learner-hub-api-testing.up.railway.app/
Database: dedicated PostgreSQL. Existing EFS/CABO production databases are excluded.

Do not enable employment application pilot, employer portfolio disclosure, or school-to-employer history sharing simply to demo a feature. Use adult dummy data and separately authorised test users.

## Acceptance criteria

- A test superadmin can manage the platform; a headmaster can only work within authorised school functions.
- Teacher assigned one course cannot read/mark another course or access school-wide rosters.
- A learner can view only their own private attendance, applications and development evidence.
- A guardian relationship does not permit direct academic access absent a dedicated authorisation workflow.
- Employers cannot access psychometric passport data or records without a separately implemented consent interface.
- Archived or revoked records do not reappear after changes to institutional memberships.
- Unit, integration, browser mobile/desktop and accessibility tests pass before release.
- Operations include recoverable versioned migrations, automated backups, alerting and incident response.

## Next priority

Replace single test user with isolated account fixtures for learner, guardian, class teacher, headmaster, university registrar, district director, verified employer and superadmin. Test each role with real sessions and PostgreSQL rows, including forbidden cross-tenant reads. Until then this is a **development pilot**, not a finished national education product.
