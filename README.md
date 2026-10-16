# Training & Development Hub — a CABO Solutions product

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

## Academic online examination integration

Create an academic assessment in **Academics**, generate a written exam in **Written exams**, assign it to a learner group in **Organizations**, and link that exam assignment to the academic assessment in **Academics**. Learners take the assigned exam as before. The moderation queue lists submitted AI-marked attempts. Teachers/assessors enter an approved mark on the academic assessment scale and must provide a justification; published marks appear in the private learner report and educator-only rankings. Raw AI marks remain separate.

The integration uses the academic_exam_links and academic_exam_reviews tables. New endpoints: POST /api/organizations/:orgId/academic/assessments/:assessmentId/link-exam; GET /api/organizations/:orgId/academic/pending-exams; POST /api/organizations/:orgId/academic/attempts/:attemptId/publish.

**Release gates:** complete actual UI and API build checks, inspect reviewed Postgres migration, and exercise multi-tenant authorization tests. Ensure teacher moderation references source answers and rubric; implement submissions locking, deadline enforcement, scoring calibration, final grade event uniqueness under concurrency, and permission regression tests before production adoption.

## CABO Solutions product branding

This platform is a **CABO Solutions product**. The visual source of truth is [CayelaemJ/CABOSOLUTIONS](https://github.com/CayelaemJ/CABOSOLUTIONS), specifically its `src/app/components/Nav.tsx`, `src/app/components/Footer.tsx`, and `src/styles/theme.css`. The source repository currently creates its CABO/Solutions wordmark with styled text and does not include separate image-logo assets; `public/cabo-wordmark.svg` is a reusable vector recreation of that source-defined wordmark, not an exported original logo file. The favicon is a CABO-inspired mark, not a verified official asset. Theme colours: clay #C4673A, gold #C9A84C, ink #0D1117, cream #F5EDE0, teal #1D6B6B. Preserve legibility and contrast across light and dark modes and do not override individual institution names with the parent vendor identity.

## Potential & Opportunity Engine (development)

This next product module introduces a private potential profile, self-reported growth/skill evidence, organisation-published career opportunities and explicit scoped requests for employer viewing. Open **My potential** in the product navigation. No psychological typing, hidden hiring scores or AI career prediction has been implemented. Employer private-profile access is **disabled by default** pending adult verification, paid entitlement checks and privacy review.

**Documentation:** Start at [docs/README.md](docs/README.md). Detailed documents cover [product vision](docs/PRODUCT_VISION.md), [architecture](docs/ARCHITECTURE.md), [privacy and consent](docs/PRIVACY_AND_CONSENT.md), [API](docs/API_POTENTIAL.md), [deployment](docs/DEPLOYMENT.md) and [roadmap](docs/ROADMAP.md). Implemented features and future aspirations are separated explicitly.

## My journey (development)

A private and explicitly self-reported Grade RR–12-to-university learning timeline and personal milestones feature is available in the **My journey** navigation area. See [Lifelong Learner Identity](docs/LIFELONG_LEARNER_IDENTITY.md) for strict provenance and future guardian/institutional verification requirements.

## Institution enrolment and guardian invitations (pilot)

The **Institutions** workspace offers institution-admin-attested enrolments, learner-initiated school-transfer requests and guardian invitations. This does **not** yet constitute official school accreditation, verified legal guardianship or automatic sharing of academic records. See [documentation](docs/INSTITUTION_TRANSFERS_AND_GUARDIANS.md).

## Role-based education governance (pilot)

The **Governance** workspace supports tenant-scoped national, provincial, district, group, school, department, grade and classroom reporting units with delegated leadership assignments. The API enforces rank and organisational scope. This pilot does not grant parent access to child records or automatically elevate academic API permissions. See [Governance Hierarchy](docs/GOVERNANCE_HIERARCHY.md).

## Role-based portals (testing)

The home dashboard now adapts to CABO's institutional hierarchy, with distinct experiences for national/provincial/district leadership, headmasters, educators, learners, parents and an isolated Railway test superadmin. Academic grading and assessment review access is restricted to assigned courses or authorised administrators. See [Role-Based Portals](docs/ROLE_BASED_PORTALS.md).

## Phases 1–4 implementation tracker

CABO's development branch includes new school attendance/notices, a candidate application workflow and a private six-month **development review** passport. Employer-facing application submission and psychometric disclosure stay gated pending independent eligibility, professional and legal review. See [Phases 1–4 delivery register](docs/PHASES_1_TO_4_DELIVERY_REGISTER.md) for what is implemented vs. still required.


---

## CABO Connected Education Ecosystem (current development)

**Vision:** A portable, verified lifelong education identity spanning early-childhood development, primary/secondary schools, university/TVET and candidate-controlled professional talent. CABO is **not** an authorised replacement for SA-SAMS, LURITS or DBE national registers today. National ingestion and production release require official agreements, lawful processing and independent security audits.

### Current technology and app
- Frontend: React, Vite, TypeScript and mobile PWA under `artifacts/training-platform`.
- Backend: Express API under `artifacts/api-server`.
- Data: PostgreSQL with Drizzle schemas under `lib/db/src/schema`.
- Deployment: isolated Railway testing environment backed by its own PostgreSQL.
- AI: OpenAI-compatible SDK, with Groq selected when `GROQ_API_KEY` is provided, otherwise `OPENAI_API_KEY`. Model IDs use `GROQ_EXAM_MODEL` and `OPENAI_EXAM_MODEL` for the existing development-plan endpoint.

### Education workflow modules
- `/school-stages`: grade RR–R, 1–7 and 8–12 development observations; enrolment and organisation access enforced server-side.
- `/school-operations`: institution notices and daily attendance.
- `/academics`: courses, subjects, assessments, permitted course staffing and results.
- `/hub-modules`: institution workflow registry for timetable, family meeting, academic intervention, bursary, sports, university module, governance, learning resources and integration proposals.
- Records start in `draft`, then move through `submitted` → `approved` → `active` → `completed`. Every transition is logged with actor, old/new state and timestamp. Locked qualification and psychological-assessment issuance cannot be bypassed by the workflow engine.
- `/governance`: institutional reporting hierarchy and delegated roles.
- `/career-passport`: private skills-development evidence and a candidate application pilot. Employer-facing psychological sharing remains off.

### API contracts added
- `GET /api/hub/modules` — module registry.
- `GET /api/organizations/:orgId/hub-records?kind=<module>` — scoped institution records.
- `POST /api/organizations/:orgId/hub-records` — owner/admin creation.
- `PATCH /api/organizations/:orgId/hub-records/:recordId/transition` — transactional approval workflow.
- `GET /api/organizations/:orgId/hub-records/:recordId/history` — privacy-scoped transition history.
- `GET /api/school-stages`, `GET /api/school-stages/me` — stage definitions and personal progress.
- `POST /api/organizations/:orgId/school-stages/progress` — matching active enrolment required.
- `GET /api/ai/capabilities` — authenticated AI provider configuration **without secrets**.
- `GET /api/platform/mlops` — isolated-test superadmin only, seven-day model usage and latency metrics.

### AI reliability and MLOps
1. Configure provider credentials **only in Railway/server environment**; never add keys to GitHub or `VITE_*` variables.
2. `POST /api/development-plans/draft` validates input, rate-limits calls, requests structured JSON and validates the model response. All AI recommendations are drafts subject to educator/guardian review.
3. The server records model provider, model ID, operation, duration and success/failure into `ai_inference_metrics`, deliberately excluding learner prompts, answers and personal profiles.
4. The superadmin can inspect aggregate errors/latency at `GET /api/platform/mlops`. A configured API key is **not** proof of successful inference; use an authenticated test call with synthetic data and verify the metrics.
5. Before production: add per-model prompt versions, eval fixtures, PII-safe tracing policies, regression benchmark gates, budget/quotas, model rollback, provider failover and incident alerting.

### Verification and local development
```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
node --test artifacts/api-server/src/tests/hubPolicy.test.mjs artifacts/api-server/src/tests/hubWorkflow.test.mjs artifacts/api-server/src/tests/schoolStagePolicy.test.mjs
```
Do not run `drizzle-kit push` against an institutional production database. Use versioned reviewed migrations and backups, and validate independent role accounts before promotion. Railway testing uses controlled synthetic fixtures only.

### Current gaps (not yet complete)
Verified national institution directory and government interoperability; production identity and parental verification; class scheduling collision resolution; real-time notifications, offline sync and outbox delivery; approved academic credentials; full university registrar workflows; external SIS integration; signed professional assessment governance; comprehensive audit and monitoring. See [national architecture](docs/NATIONAL_EDUCATION_ARCHITECTURE.md) and [connected hub sprint register](docs/CONNECTED_HUB_SPRINTS.md).

### Groq model compatibility and live MLOps check (October 2026)
The free/developer-tier Groq model `llama-3.3-70b-versatile` was retired in August 2026. Set `GROQ_EXAM_MODEL=openai/gpt-oss-120b` (or another model confirmed active for the account); the CABO default now matches. This is a Groq-hosted open-weight model ID, **not** an OpenAI API credential.

From the isolated testing superadmin screen:
1. Open **Platform administration → AI operations & model reliability**.
2. Click **Test live AI connection** to trigger `POST /api/platform/mlops/smoke-test`.
3. The server submits an entirely synthetic, non-learner prompt, checks for the expected response and records a content-free success/failure metric. The endpoint is restricted to the isolated-test superadmin and rate-limited to one request per minute.
4. A successful smoke test validates only provider connectivity and basic generation, not child-safety, learning quality, model calibration or end-to-end grading.

`GET /api/ai/capabilities` and `GET /api/platform/mlops` remain available as authenticated configuration and private monitoring endpoints. Model API keys remain server-only.

### Grade RR–12 year-end learner progression (new)
- School owners/admins use **Year-end progression** at `/school-progression` to review the school's active enrolments for a chosen year.
- `GET /api/organizations/:orgId/progression/candidates?year=2026` returns permitted year-end progression candidates.
- `POST /api/organizations/:orgId/progression/:enrollmentId` accepts `{"targetYear":2027,"decision":"promote"}` or `"repeat"`.
- API verifies institutional authority, active enrolment and sequential years, then **transactionally** creates the new active year record and completes the previous record. The prior academic history is preserved. Duplicate next-year records are rejected.
- Grade 12 does not automatically promote to university or issue an NSC credential; a separate verified school-leaving and university admission process is required.
- Promotion is an explicit school decision, not an AI recommendation. Real CAPS/IEB promotion criteria, moderation, appeal, signatures and guardian notices must be implemented before official use.
- Test rules in `schoolProgressionPolicy.test.mjs`; independently authenticated end-to-end role, race-condition and cross-school checks remain outstanding.

**Progression audit extension:** `GET /api/organizations/:orgId/progression/history` is restricted to school owners/admins and lists recorded, time-stamped promotion/repeat decisions. The progression transaction writes the new enrolment, marks the prior enrolment completed, and inserts an audit event atomically. It also rejects any existing active target-year grade for the same learner and institution. This records administrator decisions but does not implement a CAPS/IEB promotion-policy adjudicator or official school-leaving certification.

### CABO Apply — university application gateway (pilot)

- Student portal: `/cabo-apply`. A candidate can browse directory entries, select a published programme, create a private draft and track a handoff.
- API: `GET /api/admissions/institutions`, `GET /api/admissions/programmes?institutionId=...`, `POST /api/admissions/applications`, `GET /api/admissions/applications/me`, `PATCH /api/admissions/applications/:applicationId`.
- Test-superadmin maintenance: `POST /api/platform/admissions/institutions` creates **directory-only** entries; `POST /api/platform/admissions/programmes` creates **draft** programmes. Entries are not official partnerships and programmes cannot be advertised as open until independently verified and published through a reviewed workflow.
- Candidate statuses: `draft → ready_for_handoff → external_submission_recorded`. The candidate must supply a reference obtained from the official receiving system; this is **self-reported**, not receipt verification or a university decision. Partner-originated review and offer updates are intentionally not implemented until a signed admissions integration and appropriately scoped partner identities exist.
- No blanket sharing of learner history, school attendance, guardianship or psychological records. University access must be explicit, purpose-bound, revocable and audited in a future partner gateway.
- South Africa already has CAO and university-specific application channels; avoid duplicate submissions. Obtain signed API agreements before direct submission. The user must use the official portal for deadlines, fees and current requirements.
- Public institution registry must be sourced from current DHET directories and periodically verified. The application database starts empty rather than fabricating an official admissions partnership or programme catalogue.

**Social impact priorities:** reduce repeat capture, mobile data burden and travel to institutions, support low-connectivity draft preparation and accessible multilingual instructions, provide honest application receipts and reduce financial barriers. These are product objectives, not yet fully built.

### Presentation-ready synthetic school showcase

The isolated Railway `testing` deployment can populate its database with **explicitly fictional** institutions and student records. Sign in as the designated test superadmin, open **Platform administration**, then click **Load synthetic school showcase**. The loader is accessible only in the isolated testing environment when `ENABLE_CABO_DEMO_SEED=true`; repeat requests are idempotent and do not intentionally overwrite live records.

Demo entities:
- **CABO DEMO | Early Learning Centre** — Grade R, pre-primary development and early learning.
- **CABO DEMO | Tshwane Primary** — Grade 5, academic subject marks, attendance, family meetings and intervention support.
- **CABO DEMO | Pretoria Secondary** — Grade 11, academic reports, skills and university pathways.
- **CABO DEMO | University of Future Skills** — two fictitious published programme examples for the CABO Apply flow; it is **not accredited** and has no real admissions agreement.

The loader adds synthetic learners, staff, pending guardian links (no automatic access to child records), term assessments with mock marks, attendance entries, notices and institutional activities. All fake records use `CABO DEMO` labels or reserved `example.invalid` emails. It does not create real school registration, national identity, university eligibility or authorised guardian rights.

For presentations:
1. Show the **Superadmin Command Centre** and prepare the demo dataset.
2. Open **Reports & statistics** for each demo school, change the academic year to **2026**, and show attendance and grade distribution.
3. Enter a synthetic learner account ID from the seeded demo reference to view a **draft report-card preview** (not an official report card). Example: `cabo-demo-child-5a` at **CABO DEMO | Tshwane Primary**.
4. Open **School stages** to show pre-primary, primary and high-school intervention data.
5. Open **Institution hub** to explore timetable, parent meetings, sports, bursaries and institutional governance proposals.
6. Open **CABO Apply** to find the fictional university programmes and demonstrate a private application draft; no real university receives it.
7. Discuss the future consent-based qualifications and talent passport roadmap without claiming live psychometric or employer integrations.

Developer API routes:
- `GET /api/organizations/:orgId/analytics?year=2026`: institution-admin statistics.
- `GET /api/organizations/:orgId/reports/:learnerId?year=2026`: authorised draft report-card preview.
- `GET /api/reports/me?organizationId=...&year=2026`: learner's own preview.
- `POST /api/platform/demo/seed`: isolated test superadmin only.

**Limits:** this is a demonstration of connected school workflows, not an official SA-SAMS replacement, nationally accredited credentials, complete QR/offline timetabling, verified university integrations or live qualified psychological assessment. Independent multi-role browser testing, real integrations and external approval remain release gates.

### School report-card issuance workflow (testing prototype)
CABO separates calculated report previews from frozen, versioned, internally approved report records:
1. An institution owner/admin submits a learner's report via `POST /api/organizations/:orgId/report-issuance`. The API requires published assessment results and a matching school enrolment, freezes the calculated snapshot and stores a SHA-256 content fingerprint.
2. A **different** institution administrator reviews the submitted record, then approves or rejects it with an audited action using `POST /api/organizations/:orgId/report-issuance/:reportId/decision`. Rejections require a reason.
3. An authorised manager may `issue` an approved report or `revoke` an issued record with a reason. The original report snapshot is not modified.
4. Learners see only their own issued versions via `GET /api/report-issuance/me`; appropriately verified guardians see only school-specific authorised child reports via `GET /api/guardian/issued-reports/:learnerId?organizationId=...`. The report management queue is private to school owners/admins.
5. School users access the queue at `/report-issuance` and learners see issued snapshots in `/education-reports`.

**Important:** SHA-256 is an integrity fingerprint, **not** an asymmetric cryptographic signature or proof of government/IEB accreditation. This workflow is a testing prototype. External verification, signing-key infrastructure, independent review/identity verification, signatures, province-specific approval policies, correction appeals, full historical reporting and separate-role browser tests remain outstanding. Do not present the records as legally certified qualifications.

### School Intelligence and attendance sync (new development)
School administrators use `/school-intelligence` to review academic support signals and attendance by year. Authenticated APIs: `GET /api/organizations/:orgId/academic-intelligence?year=2026`, `GET /api/organizations/:orgId/attendance/summary?year=2026` and `POST /api/organizations/:orgId/attendance/sync` with `{"entries":[{"learnerId":"...","day":"2026-10-16","status":"present"}]}`. Uploads are limited to 100 records, require an active year-matched school enrolment, and return per-row conflict statuses rather than overwriting marks. The client pilot includes manual JSON replay; **device-side durable offline capture, push notifications and QR attendance are not implemented**. Subject and attendance thresholds merely generate teacher-review signals, never automatic decisions.

See [eight-workstream release and evidence register](docs/EIGHT_WORKSTREAM_RELEASE_GATES.md) before claiming completion or launching with real learners.

### Curriculum assessment question bank
`/question-bank` gives institution-authorised staff an attributed/licensed draft question bank. Teachers submit drafts; an independent school owner/admin approves them before publication. These are **not** a government-approved curriculum bank and are not automatically usable as public exam papers. APIs: `GET/POST /api/organizations/:orgId/question-bank`, `POST /api/organizations/:orgId/question-bank/:questionId/decision`. Every transition is audited. Learners are denied access to the answer guide. Before official exam use: independent licence audits, CAPS/IEB version validation, accessibility and moderation evidence.
