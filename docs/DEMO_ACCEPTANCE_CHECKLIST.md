# CABO Demo — Role-Based Acceptance and Presentation Checklist

Run only on the isolated Render **testing** service. The synthetic demo data is explicitly fictitious. Do not use real children's identities or grades.

## Preflight
- Latest Render deployment uses the current native-test preview commit and reports **live**.
- CI type checks and tests pass.
- Superadmin opens `/platform-admin`, selects **Load synthetic school showcase**, then checks readiness metrics show three schools with learner records, published marks, attendance, and two fictitious university programmes.
- Superadmin opens `/education-reports`, selects **CABO DEMO | Tshwane Primary**, year 2026 and learner ID `cabo-demo-child-5a`. The report must show subjects, mark percentages, attendance and prominent **Draft preview / Not official** labelling.
- Repeat the check for Grade R (development observations, **not** diagnostic assessment) and Grade 11 (career pathways).

## Four independent sessions — mandatory release gate
**School leader**
- School owner/admin sees only assigned institutions; can view school analytics and named learners' preview reports within those institutions.
- Cannot open a learner in another school or create an official qualification simply by entering a URL.

**Teacher**
- Has their own login and assigned courses.
- Can work on their own classes, teaching materials and approved assignments; cannot see unrelated learners or all-school confidential records.
- School-wide report access remains prohibited unless explicitly authorised.

**Learner**
- Own login and corresponding synthetic enrolment.
- May view *only their own* published marks and progress; no administrative approval actions.
- Can create CABO Apply draft, but never falsely assert an official university acceptance.

**Guardian**
- Independent synthetic parent test login with an **accepted but unverified** guardian relationship.
- Must NOT see the child's report, grades, attendance, psychometrics or credentials merely because a request exists.
- Guardian identity/authority verification and explicitly scoped release remain additional implementation work.

## Critical negative tests
1. Anonymous requests to private endpoints return 401.
2. Cross-institution learner/teacher queries return 403 or 404 without data.
3. Unverified guardians cannot retrieve child records.
4. No secret/API key appears in public HTML, source maps, API responses or logs.
5. Demo seed refuses in production and is idempotent when repeated.
6. Statistics filtered to academic year; marks filtered to the learner's enrolled grade.
7. No student-facing text claims demo degrees, qualifications, admissions or universities are official.
8. Synthetic university is not displayed as a real accredited provider.
9. Student submits no real application without a receiving institution receipt or approved integration.
10. Mobile viewport: navigation, report table and assessment controls work without horizontal overflow.

## Presentation pathway
Superadmin command centre → choose synthetic primary school → published mark report → attendance & development → sports and family interaction → secondary stage & Grade 11 → CABO Apply fictional programme → candidate-controlled talent vision. Every external/unbuilt integration should be called out as a roadmap item.

## Remaining implementation (not signed off)
Real independent test-account E2E browser evidence, official report issuance, QR attendance, offline sync, automated timetables, educational notifications, guardian-authority verification, moderation and signing, registrar/API partner integrations, school data migration and DBE approvals. CI success and Render live status alone do not prove these user journeys. The accepted-but-unverified parent redaction flow has been smoke-checked; verified, revoked, cross-school and unenrolled cases remain open.
