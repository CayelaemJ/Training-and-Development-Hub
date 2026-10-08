# Lifelong Learner Identity — Phase 1

## Purpose

Carry a private personal timeline of the learner's own education and growth across Grade RR, Grade R, Grades 1–12, college, university, training and professional experience. This is a preparatory identity layer for the future CABO lifelong development model, **not** a verified national learner registry or official school information system.

## Implemented

- `learner_identities`: one private profile per authenticated user account (user ID is the existing auth ID).
- `learner_journeys`: user-created school/institution name, grade or phase, academic year and a free-text note.
- `learner_milestones`: user-created learning milestones, projects, technical achievements and other growth evidence.
- `/api/learner-journey/me`, `PUT /api/learner-journey/me`, `POST /api/learner-journey/entries`, `DELETE /api/learner-journey/entries/:id`, `POST /api/learner-journey/milestones`, `DELETE /api/learner-journey/milestones/:id`.
- Frontend page **My journey**, accessible alongside **My potential** and the academic tools.
- All access is private to the signed-in account. Deletes filter by both user ID and record ID. No directory or employer-readable learner timeline API exists.

## Data classification

Every entry created in this phase has `source=self_report`. Do not represent self-reported school history as verified academic enrolment, legitimate transcripts or a certified national record. The academic institution ID field is nullable and is intentionally **not supplied via the public endpoint**, preventing a self-report from becoming a falsely institution-verified event.

## Pending essential features

1. Stable portable learner identifier decoupled from provider-specific login, with secure account linking and recovery.
2. Guardian relationship and role/consent verification for minors, including age-appropriate use design.
3. School administrator verified enrolment and educator-verified milestone issuance with audit trail.
4. Verified school transfers and formal portability permission workflow.
5. Explicit historical records import, export and corrections with provenance and dispute process.
6. Official NSC/IEB subject outcome sources, scheme of work, attendance and optional tertiary credentials.
7. Automated integration testing for account isolation, data retention, subject requests and academic trust boundaries.
8. PostgreSQL reviewed migrations and rollback validation against a staging environment.

## Privacy requirements

Never expose this childhood timeline to employer consent endpoints. Access to school history is not a default part of a later professional profile. Data portability requires purpose-based approval and technical safeguards, not automatic institution-to-institution broadcasts. No national ID number or date of birth is stored in the learner timeline introduced here.

## Test scenarios

- Learner A cannot view/delete Learner B's timeline or milestones.
- Malformed stage/year/reason payload rejected by server.
- Existing employer access grants cannot read any learner-journey routes.
- Grades RR through matric and later college/university stages render correctly.
- Unverified entries visibly labelled self-reported.
- Existing CABO navigation and academic gradebook still operate.
