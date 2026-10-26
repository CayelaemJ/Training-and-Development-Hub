# CABO — Eight Workstreams: Engineering Release & Evidence Register
Date: 2026-10-16. Scope: South African isolated synthetic pilot only.

## General acceptance gate
An item is NOT complete merely because a UI page, schema, or API route exists. Require tenant-isolation and legal-authority tests, authenticated learner/teacher/parent/administrator journey recordings, performance and failure-mode tests, data migrations and rollbacks, secure deployment, documentation, and formal stakeholder sign-off.

## 1. Complete multi-role verified demo
**Current:** synthetic Grade R/5/11 schools, demo enrolments and assessments, role-specific routes, existing seeded identities and demo status. 
**Not done:** independently executed authenticated end-to-end flows; guardian revocation and multi-school tests; evidence of deployed demo fixture counts and all ten modules populated.
**Pass:** browser-based replay with separate auth cookies for 4+ roles, auditable 403/404 for unauthorized data, repeatable demo seeding and reports.

## 2. Certified report cards
**Current:** frozen snapshots, independent reviewer requirement, audit, SHA-256 integrity, revocation, learner/guardian private access.
**Not done:** asymmetric issuer signatures, key rotation/HSM, public scoped verification, official templates/rules, appeals and effective-date revocations.
**Pass:** verifiable signed credentials with official recognised issuer and regulated certification.

## 3. Timetable/attendance
**Current:** attendance capture and replay-safe bulk sync with year/enrollment checks and conflict feedback; human-review dashboard.
**Not done:** true offline client queue with durable sync, camera QR anti-fraud, alerts, timetable solver/substitution policies.
**Pass:** offline device sync tests + teacher conflict solver tests + parent alert delivery/retry evidence.

## 4. Academic Intelligence and MLOps
**Current:** learner report previews; subject and attendance support signals (50% marks and 80% attendance initial editable product assumptions) requiring educator interpretation; Groq provider smoke-test and content-free basic metrics.
**Not done:** longitudinal moderated intervention feedback, provider failure recovery, prompts/eval versioning, drift and bias assessments, budgets, safeguarding and grade-specific safety evaluations.
**Pass:** educator-approved plans and repeatable protected evaluation benchmark, alert thresholds signed off.

## 5. Assessment Studio
**Current:** existing assessment/grades/exam scaffolds, moderation statuses and event history.
**Not done:** validated licensed curriculum banks, full rubric and examination moderation workflows, assistive accommodations and exam integrity testing.
**Pass:** question copyright/provenance checks, review evidence, manual overridable marking and accessibility tests.

## 6. University, Apply, qualifications and talent
**Current:** application drafts/official handoff, empty/fictional directory, study/career modules and candidate-scope data policy.
**Not done:** authorised partner submission with receipt, registrar credit rules, verified signature credentials, institution consent grant and graduate-only recruiter access.
**Pass:** partner sandbox contract tests and signed formal institutional agreements.

## 7. Education command centre
**Current:** tenant-scoped school statistics and organisational hierarchy; no verified DBE data.
**Not done:** circuit/district/province aggregation with delegated grants, minimum-cell thresholds for small cohorts, historical metrics and official EMIS mapping.
**Pass:** delegated district and province test accounts cannot enumerate unauthorized schools or identify individual learners.

## 8. Production security and operations
**Current:** scoped auth routes, test guards, PR checks and basic audit/telemetry, isolated Render pilot.
**Not done:** independent penetration test, POPIA children-lawful-basis/retention assessments, DR rehearsal, verified backups/restore, migrations, uptime and incident on-call, hardening and real scaling.
**Pass:** signed findings clearance, completed DPIA, simulated outage/restore, incident response and external privacy counsel approval.

**Do not falsely claim:** government recognition, national learner migration, SOC 2, accredited qualification issuance, live university submissions, signed certificates, completed psychometrics, or national production readiness.
