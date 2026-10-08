# Training & Development Hub

A flexible learning and assessment application for individual learners, students, teachers and future company training programmes.

## Current capabilities

- Private TXT, Markdown, PDF and DOCX learning-material uploads.
- Multiple-choice practice tests with automatic grading.
- **Written examinations** generated from uploaded documents.
- Short-answer, long-answer and scenario-based questions, with marks and source-grounded rubrics.
- Free-text submissions assessed by an AI model using partial-credit marking.
- Per-question feedback, total marks, percentage scores and review flags.
- User-specific access to uploaded materials, examinations and results.

## Written examination workflow

1. Sign in and upload your notes under **Study materials**.
2. Select **Written exams** in the navigation.
3. Choose a document, difficulty and 1–15 questions, then generate.
4. Answer every question in your own words.
5. Submit for scoring and read the feedback.

AI-generated marks are advisory. They should not be treated as final decisions for high-stakes academic, regulatory or employment qualifications without human oversight.

## Development

- Install dependencies: `pnpm install`
- Prepare the database: `pnpm --filter @workspace/db run push` (development only, first inspect changes; use reviewed migrations in production)
- Run API: `pnpm --filter @workspace/api-server run dev`
- Run UI: `pnpm --filter @workspace/training-platform run dev`
- Validate: `pnpm run typecheck && pnpm run build`

Environment: `DATABASE_URL` for PostgreSQL and `OPENAI_API_KEY` for AI generation and marking; private object storage and authentication must also be configured per the existing project infrastructure. Override the exam model with `OPENAI_EXAM_MODEL` if needed. Never expose secrets to the browser.

## Architecture

- React + TypeScript UI: `artifacts/training-platform`
- Express API: `artifacts/api-server`
- PostgreSQL / Drizzle schema: `lib/db/src/schema`
- Existing generated REST client and API contract: `lib/api-spec`
- Written exam API: `POST /api/materials/:id/written-exams`, `GET /api/written-exams`, `GET /api/written-exams/:id`, `POST /api/written-exams/:id/attempts`

## Security and assessment notes

Written answer keys and rubrics remain server-side until assessment; learner examination endpoints expose prompts, type and maximum marks only. All records are scoped to the authenticated user. The model must award no more than the rubric's maximum marks, with partial credit and review flags.

**Limitations of this first iteration:** source processing currently uses up to 40,000 characters; there is no formal assessment publishing, enterprise tenancy, automated draft autosave, teacher override, grading calibration, exam timer, plagiarism handling or certification workflow yet. Review model outputs, add rate limits and usage quotas, set upload retention rules, add migrations and tests before production rollout.

## Organization workspaces (feature branch)

The platform keeps **personal study** available without an organization. An authenticated user can optionally create a company, university, school or training workspace.

Workspace workflow:
1. Create an organization in **Organizations**.
2. Add existing signed-up users by email as admins, teachers, assessors or learners. Only the owner can add admins; a learner must first have an account.
3. Create learner groups and add learner members.
4. Generate a written exam from your own material and assign it to a group with an optional deadline.
5. Learners find assigned exams under **Written exams**, write responses and receive AI-assisted marking.
6. Staff view aggregate organization statistics and submitted results, then record per-question human adjustments with a reason and immutable audit entries.

Endpoints are defined in `artifacts/api-server/src/routes/organizations.ts`; database entities in `lib/db/src/schema/organizations.ts`.

**Before rollout:** Run `pnpm run typecheck && pnpm run build`, apply database migrations safely, and test multi-account access control, authorization across two organizations, due dates, group enrollment, assessor permissions, override histories, and submission aggregation. Marking overrides are stored as audit entries, but *effective final scores and dashboards do not yet incorporate them*. Do not advertise reviewed grades as finalized. Organizational invitations, member removal, tenant-wide material libraries, robust notification delivery, role administration, production database migrations and automated tests are not included yet.

## Schools and universities (academic phase)

The **Academics** page extends optional organization workspaces into schools and universities.

- School modes: NSC, IEB or custom; university modes: university or custom.
- Subjects/modules and educational level, optional university credits.
- Academic periods for school terms or university semesters.
- Learner enrollment into subjects and modules.
- Assignment, test, exam, practical, oral and project gradebook records.
- Teacher marking as drafts or published results, with an immutable event history recording the reason, assessor, former value and new value.
- Private learner reports with weighted period-level subject/module performance over time.
- Staff-only academic reporting and top-10 ranking per subject/module and period, using published results only.

**Important:** The system does **not** yet implement official NSC/IEB promotion rules, subject-level CAPS requirements, official Umalusi/IEB recognition, official transcripts, pass/fail progression, or university-specific qualification rules. Institution framework metadata does not imply compliance with any examination body. School-specific prescribed SBA, PAT, oral and exam weighting varies by subject, grade, assessment period and qualification: there is no universal formula hardcoded. Configure and validate it with the latest official regulatory documents before reporting final certificates.

**Score interpretation:** Weighted results are calculated as sum(percentage × configured assessment weight) / sum(configured weights for published assessments). An incomplete weighting is flagged as partial. Top-10 lists are *private to staff* and based on a comparable subject and term, not schoolwide or university-wide rankings across unrelated course combinations. School learner performance and educational personal data are confidential; no public leaderboard is provided.

**Limitations before rollout:** Academic gradebook records currently store assignment instructions and marks but do not yet provide their own online submission page. For online written exams, use the existing Written exams and Organizations assignments features. Academic assessments and the online written-exam system still need integration for automatic mark transfer and moderated final scores. Student term/year aggregate reports, PDF exports, parent access, attendance, timetables, academic promotion rules and versioned assessment templates are next-phase work.

API endpoints are in `artifacts/api-server/src/routes/academic.ts`; PostgreSQL tables in `lib/db/src/schema/academic.ts`. Apply reviewed schema migrations, test access with multiple institutions and student accounts, calibrate grading rules, and verify the CI build before production use.
