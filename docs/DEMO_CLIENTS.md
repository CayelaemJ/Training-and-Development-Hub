# CABO sandbox demo clients — 9 October 2026

**TESTING ONLY.** Fictional organisations, learners, employers, academic grades and names. No real people, school accreditation or psychometric assessment claims. Never enable this seeder in production.

## Demo organisations

| Fictional client | Type | Framework | Test purpose |
| --- | --- | --- | --- |
| [DEMO] Ubuntu Future Secondary School | Public-style secondary school | NSC | Headmaster, district director, educators, Grade 12 learners, guardian, attendance, academic reports |
| [DEMO] Highveld Independent Academy | Independent school | IEB | Cross-school privacy and isolation |
| [DEMO] Mzanzi Digital University | University | UNIVERSITY | Registrar, lecturer, first-year learner, semester grading |
| [DEMO] Kwezi Skills & Training | Training company | None | Company workspace and employer-facing permissions (employment pilot remains disabled) |

## Fictional users and example workflows

The seeder creates 13 `cabo-fixture-*` identities with `@example.invalid` addresses. The usernames below are supported by the test-login mechanism **only when** a matching salted-scrypt entry is configured in `CABO_TEST_USERS_JSON` in Railway testing. The seeder itself creates no credentials or passwords.

| Suggested login | Fixture ID suffix | Experience |
| --- | --- | --- |
| cabo_headmaster_south | headmaster-south | School leadership |
| cabo_teacher_south | teacher-south | Grade 12 Mathematics teacher |
| cabo_assessor_south | assessor-south | Physical Sciences assessor |
| cabo_learner_south_a | learner-south-a | NSC learner with two published synthetic marks |
| cabo_learner_south_b | learner-south-b | Second learner with different results |
| cabo_parent_south | parent-south | Guardian invitation/relationship; no automatic grades |
| cabo_district_south | district-south | Delegated district role in one organisation |
| cabo_university_head | university-head | University administration |
| cabo_university_teacher | university-teacher | Programming lecturer |
| cabo_university_learner | university-learner | First-year student |
| cabo_headmaster_north | headmaster-north | Independent-school leadership |
| cabo_learner_north | learner-north | Isolated IEB learner |
| cabo_company_head | company-head | Training company owner |

Each test principal must have `userId: "cabo-fixture-<suffix>"`, `email: "<suffix>@example.invalid"`, matching fictional first/last name and an independently salted scrypt hash. `cabo_test` superadmin remains separate and untouched. Passwords must not be committed.

## What the fixture creates

- Four organisation workspaces with tenant-specific membership.
- NSC, IEB and university academic settings, Grade 12 and Year 1 courses.
- Learner groups, subject enrollments and course-specific teacher/assessor assignments.
- Four synthetic assessments with different marks, human-readable feedback and audit events.
- Example attendance and a school notice.
- School/university management-unit roles and one synthetic accepted guardian relationship. This is **not** legal guardianship verification.

## How to activate

1. In the isolated Railway **testing** API service only, set `ENABLE_CABO_DEMO_SEED=true`. Do not set it on a shared environment or production.
2. Deploy this feature branch. At startup the server seeds the fixtures asynchronously. Check Railway deploy logs for `CABO synthetic fixtures ready`; deployment success alone does not prove the database was seeded.
3. Optionally configure `CABO_TEST_USERS_JSON` with salted-scrypt role login verifiers using the already implemented test authentication route. Each role must have a separate test account.
4. Sign in to the test site and verify the portals. Repeated deploys preserve edited marks and do not duplicate seed rows.
5. Turn off `ENABLE_CABO_DEMO_SEED` after setup if no new fixtures are needed.

## Verification plan

- Superadmin lists all four synthetic organisations.
- School headmaster sees only school operations; university head sees only university.
- Teacher sees Mathematics but cannot mark Physical Sciences; assessor sees the reverse.
- Learner A sees own marks (82 Mathematics, 74 Physical Sciences), not learner B's (64, 88).
- Parent cannot retrieve learner grades merely because of the synthetic guardian relationship.
- Independent-school users cannot access NSC school membership or reports.
- Employer cannot retrieve learner marks or private psychometric passport data.
- Generate a Groq-backed written exam from an uploaded *synthetic* document, assign to a demo learner, submit and review AI marks; this workflow requires live authenticated sessions and configured object storage.

**Limitations:** This fixture creates baseline database rows, not real AI exams or an end-to-end test result. The company has no academic framework. Any failure to seed is logged but does not crash the API. Never claim real multi-user testing until requests and permission denials are exercised.
