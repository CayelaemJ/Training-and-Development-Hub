# CABO Connected Hub — sprint delivery and production gates

This branch adds a responsive 12-module institution workspace and tenant-scoped `hub_records` registry. It builds on the existing learner development plan, academic exams, attendance, sports, career applications and school governance routes rather than replacing them.

| Stream | Existing platform | This sprint | Still required for a genuinely complete product |
|---|---|---|---|
| Academic intelligence | Assessments, grade reports, learner development | Private intervention records | Approved learning evidence, holistic dashboards, class-level dashboards, moderation |
| Timetable and attendance | Daily attendance | Institution timetable entries | Class scheduling conflict engine, recurring schedules, notifications, offline sync |
| Parent Connect | Guardian invitation flows | Private family meeting records | Legal guardian verification, meetings, parent notifications, scoped report-card consent |
| Qualifications wallet | Institution enrolments, academic results | Visible credential module, issuance locked | Institutional issuer verification, digitally signed documents, revocation and verification API |
| Career navigator | Opportunities and applications pilot | Bursary registry entries | Eligibility matching, provider verification, application workflows |
| Sports | Sports development tracking | Activity/event registry | Coaching metrics, authorised athlete consent, team schedules |
| Assessment studio | Written exams and marking | Assessment workflow visibility, unverified issuance locked | Licensed instruments, validity/fairness evidence, accredited professional oversight |
| University registrar | School and institution workflows | Module/semester planning records | Prerequisites, enrolment, credits, graduation, transcript sign-off |
| Talent passport | Private evidence and career passport | Strict candidate-specific skills record | Candidate consent, professional verification, employer pilot approval |
| Education command centre | Reporting hierarchy and admin dashboard | Restricted governance actions | National/provincial aggregate reporting, thresholds and official data agreements |
| Offline and multilingual | Mobile PWA shell | Learning resource/translation catalogue | Offline encrypted content sync, translation review, approved curricula |
| Institution integrations | Basic backend APIs | Institution-only integration inventory | Secure OAuth/OIDC, APIs, revocation, webhook delivery and provider contracts |

## API pilot

- `GET /api/hub/modules`: module capabilities, authenticated.
- `GET /api/organizations/:orgId/hub-records?kind=...`: requires active member or learner enrolment, filters records according to the caller's institution and per-record restrictions.
- `POST /api/organizations/:orgId/hub-records`: organisation owner/admin only. Private individual records require an institution-enrolled learner ID. Credential or assessment issue attempts fail closed.

**Privacy policy**: no parent access to sensitive child records merely because a guardian invitation exists. Sensitive learner-level interventions, meetings, credential metadata and talent skill entries are not disclosed to other learners or ordinary teachers. Credentials and assessment instruments are not certified simply because data can be entered.

## Required before pilot goes beyond dummy data

Versioned schema migrations, environment isolation, integration and browser tests with genuinely distinct users, validated school/university workflows, verified guardians, POPIA legal review for children, approved assessment instruments, accessibility, incident response, signing keys for credential issuance and fully configured storage/backups.

Railway's existing testing environment uses a dedicated Postgres and CI; this branch is NOT automatically deployed or merged. End-to-end platform readiness must be measured against acceptance tests, not the presence of modules in the navigation.
