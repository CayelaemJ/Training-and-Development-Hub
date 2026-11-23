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

The current main-branch seeder creates 14 `cabo-fixture-*` identities with `@example.invalid` addresses. The usernames below are supported by the test-login mechanism **only when** a matching salted-scrypt entry is configured in `CABO_TEST_USERS_JSON` on the isolated Render test service. The seeder itself creates no credentials or passwords. Native test login can use separately hashed principals from `CABO_TEST_USERS_JSON`; the isolated Render preview currently exercises the synthetic `cabo_parent_south` account.

| Suggested login | Fixture ID suffix | Experience |
| --- | --- | --- |
| cabo_headmaster_south | headmaster-south | School leadership |
| cabo_teacher_south | teacher-south | Grade 12 Mathematics teacher |
| cabo_assessor_south | assessor-south | Physical Sciences assessor |
| cabo_learner_south_a | learner-south-a | NSC learner with two published synthetic marks |
| cabo_learner_south_b | learner-south-b | Second learner with different results |
| cabo_learner_south_c | learner-south-c | Third learner with cross-subject results and a portfolio example |
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
- Eleven synthetic assessments across the three 2026 terms (six additional trend records plus five original assessments), with varied marks, feedback and grade audit events.
- Twelve October days plus fourteen September weekdays of varied attendance for three learners (78 entries), active enrolments, a teacher-owned support case, connected-hub examples and a school notice.
- Ten learner-journey entries, eight self-reported milestones, five grade-matched school-stage observations and five owned practice materials/quizzes. These are **synthetic and not institution-verified credentials**.
- School/university management-unit roles and one synthetic accepted guardian relationship. This is **not** legal guardianship verification.

## Temporary credentials for the isolated web demo

The 14 fictional roles can share one **temporary** password for a supervised demo. Their credentials are not stored in the seeder, and the demo identity email addresses remain non-deliverable. Generate a fresh, independent salted-scrypt hash for every fixture role using `scripts/generate-demo-login-config.mjs`. This creates **web test-login** principals only; it does not modify OIDC users, production accounts, or the separately guarded `cabo_test` native/superadmin credential.

In WSL/Linux, run the following **locally**, with a disposable test database and a private test deployment already identified:

```bash
umask 077
export CABO_ENVIRONMENT=testing CABO_TEST_DATABASE_ISOLATED=true NODE_ENV=test
export CABO_ALLOW_WEAK_DEMO_PASSWORD=true  # required only for passwords shorter than 12 characters
read -r -s -p "Temporary synthetic-demo password: " CABO_DEMO_PASSWORD
printf '\\n'
export CABO_DEMO_PASSWORD
node scripts/generate-demo-login-config.mjs > /tmp/cabo-demo-users.json
unset CABO_DEMO_PASSWORD
```

Copy the **complete JSON contents** of `/tmp/cabo-demo-users.json` to the test-only service's secret environment variable `CABO_TEST_USERS_JSON`, then securely delete the temporary file. Ensure `ENABLE_CABO_TEST_LOGIN=true`, `CABO_ENVIRONMENT=testing`, and `CABO_TEST_DATABASE_ISOLATED=true` **on that test service**. All 14 usernames in the table above will use the password you supplied. No command in this guide automatically changes a deployed service, and a seed run alone does not activate web sign-in.

If you choose a 5-character demo password, it is trivially guessable. **Never use it on a public or production service, for real learners, or for the platform superadmin.** Restrict network access to the disposable testing service, supervise its use, and disable `ENABLE_CABO_TEST_LOGIN` or rotate the test credentials immediately after demonstrations. `CABO_ALLOW_WEAK_DEMO_PASSWORD` is only a local generator opt-in; it does not weaken the application authentication policy.

Verification: run `node --test artifacts/api-server/src/tests/demoLoginConfig.test.mjs`, then validate each role's own dashboard and cross-tenant 403/404 denials in the isolated browser session. A successful generator run does not prove environment updates, deployment, login, or end-to-end authorization.

## How to activate

1. In an isolated **testing** API service only, set `CABO_ENVIRONMENT=testing`, `CABO_TEST_DATABASE_ISOLATED=true`, and `ENABLE_CABO_DEMO_SEED=true`. All three gates are mandatory. Do not set them on a shared environment or production.
2. Deploy this feature branch. At startup the server seeds the fixtures asynchronously. Check Render deploy logs for `CABO synthetic fixtures ready`; deployment success alone does not prove the database was seeded.
3. Optionally configure `CABO_TEST_USERS_JSON` with salted-scrypt role login verifiers using the already implemented test authentication route. Each role must have a separate test account.
4. Sign in to the test site and verify the portals. Repeated deploys preserve edited marks and do not duplicate seed rows.
5. Turn off `ENABLE_CABO_DEMO_SEED` after setup if no new fixtures are needed.

There is deliberately no production-capable reset command. Reset the disposable test database through the approved environment/database lifecycle, then rerun the idempotent seeder. This avoids a broad in-application delete path for children's records.

## Verification plan

- Superadmin lists all four synthetic organisations.
- School headmaster sees only school operations; university head sees only university.
- Teacher sees Mathematics but cannot mark Physical Sciences; assessor sees the reverse.
- Learner A sees own marks (82 Mathematics, 74 Physical Sciences, 86 Life Orientation), not learner B's (64, 88, 76) or learner C's (71, 69, 81).
- Parent smoke check passed for the accepted-but-unverified synthetic relationship: no learner name or learner ID is returned. School-verified, active-enrolment and revocation cases remain untested.
- Independent-school users cannot access NSC school membership or reports.
- Employer cannot retrieve learner marks or private psychometric passport data.
- Generate a Groq-backed written exam from an uploaded *synthetic* document, assign to a demo learner, submit and review AI marks; this workflow requires live authenticated sessions and configured object storage.

**Limitations:** This fixture creates baseline database rows, not real AI exams or an end-to-end test result. The company has no academic framework. Any failure to seed is logged but does not crash the API. Never claim real multi-user testing until requests and permission denials are exercised.
