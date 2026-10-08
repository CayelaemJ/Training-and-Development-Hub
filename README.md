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
