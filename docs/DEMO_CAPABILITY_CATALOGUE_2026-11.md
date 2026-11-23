# CABO Learning Hub — Capability Catalogue and Proof Standard

**Prepared:** 22 November 2026 | **Purpose:** investor, school, educator and pilot-partner demonstrations | **Owner:** CABO Solutions (independent product initiative, not an accredited or government programme)

**Category:** Connected Education and Lifelong Development Platform. Learning management is one component, not the product's whole identity.

> This is a claim-control catalogue, **not a certification**. A repository route or UI component proves there is implementation work, not that the production service has passed a security audit or that every user journey works on every device.

## Status definitions

- **Source implementation:** API/UI/schema or tests exist in the repository; actual browser/device and deployed-environment verification may still be outstanding.
- **Isolated demo verified:** a particular workflow has been exercised in the disposable synthetic-only environment, with a dated evidence record.
- **Pilot / gated:** accessible only to specially configured, authorised, limited-scope pilot users, or deliberately disabled by default.
- **Partner validation required:** curriculum, operational fit, real-user outcomes, legal/compliance, accreditation or external integrations cannot be proved with synthetic fixtures.
- **Roadmap:** conceptual or partial implementation; do not present as available now.

Status in the table is the **most conservative status supported by reviewed code/documentation**. See [delivery register](PHASES_1_TO_4_DELIVERY_REGISTER.md) and [canonical identity](PLATFORM_IDENTITY.md).

| Pillar / capability | Evidence in code | What the demonstration may show | Current claim and critical caveat |
| --- | --- | --- | --- |
| Private study material management | `routes/storage.ts`, `routes/training.ts`, `schema/training.ts` | Owned learning material and sample practice content | **Source implementation**; user isolation and storage integration must be tested per deploy |
| Practice quizzes | `routes/training.ts`, `lib/demoSeed.ts` | Fictional algebra and English examples | **Source implementation**; example quizzes are synthetic, not AI evaluations |
| Written AI-assisted exams | `routes/writtenExams.ts` | Draft questions, written answers and advisory feedback where AI is configured | **Pilot / gated by provider and evaluation**; no certified grading |
| Institution and class groups | `routes/organizations.ts` | School/university workspaces, course and group memberships | **Source implementation**; membership does not establish real school registration |
| Subject/module assessment and audit | `routes/academic.ts`, `schema/academic.ts` | Multi-term marks, grade visibility, examiner permissions, audit entries | **Source implementation**; official weighting, score moderation and accreditation remain unverified |
| Teacher human moderation | `routes/academicExamLinks.ts` | AI draft → human assessment workflow | **Source implementation**; must test final score integration and overrides |
| Attendance and school notices | `routes/attendanceSync.ts`, `schema/schoolOperations.ts` | Fictional school days and notices | **Source implementation**; not a validated live-register replacement |
| School stages / development observations | `routes/schoolStages.ts`, `schema/schoolStages.ts` | Grade-matched, institution-scoped learning observations | **Source implementation**; observations are supportive, not diagnoses |
| Learner journey and milestones | `routes/learnerJourney.ts`, `schema/learnerJourney.ts` | Multi-year self-reported stages and fictional milestones | **Source implementation**; self-report ≠ verified achievement or transfer |
| Learner support tickets | `routes/learnerSupport.ts`, `schema/learnerSupport.ts` | Tutor/teacher support, practice and follow-up status | **Source implementation**; educator decisions remain human-led |
| Hub records: sport, timetable, consultations | `routes/hubModules.ts`, `schema/hubRecords.ts` | Linked fictional records representing 10 connected modules | **Pilot**, not a certified sports ranking or scheduled official event |
| Institution/management governance | `routes/managementHierarchy.ts`, `routes/rolePortals.ts` | Headmaster, teacher and district scopes | **Source implementation**; no government-delegated authority implied |
| School configuration / progression | `routes/institutionSetup.ts`, `routes/schoolProgression.ts` | Draft school setup and progression review | **Pilot / partner validation**; no automatic CAPS, NSC or IEB official decision |
| Reports and institution intelligence | `routes/reportCards.ts`, `routes/academicIntelligence.ts`, `routes/educationCommand.ts` | Approved reports / aggregate views when backed by data | **Source implementation**; validate denominator, completeness and privacy |
| Guardian relationship and verification | `routes/guardianVerification.ts`, `routes/nativeParent.ts` | Invitation/relationship status and a deliberate restricted-access example | **Pilot / gated**; an accepted but unverified invitation does NOT provide a child's grades |
| Communication and preferences | `routes/notificationPreferences.ts`, `schema/notificationConsent.ts` | Preference/consent concepts where enabled | **Gated**; do not promise delivery or consent validity without end-to-end proof |
| Admission pathway and evidence | `routes/admissions.ts`, `routes/admissionEvidence.ts` | Learner-controlled private application draft and external handoff | **Pilot**; no official institution submission, admissions decision or guaranteed offer |
| Learner passport and trust layers | `routes/lifelongPassport.ts`, `routes/passportTrustRoutes.ts` | Self-report / reviewed evidence layers, if enabled | **Pilot / validation required**; no government-recognised credential |
| Potential and opportunities | `routes/potential.ts`, `schema/potential.ts` | Learner growth and age-appropriate future opportunity concepts | **Gated**; employer disclosure is disabled by default |
| Responsible AI profiles/insights | `routes/learnerAiProfile.ts`, `routes/developmentPlans.ts`, `routes/mlops.ts` | Reviewable advisory drafts and evaluation plans | **Pilot / evaluation required**; no unreviewed automated decisions about children |
| Native Android/iOS and Windows | `native-apps/` and associated CI workflows | Device-specific prototype flows and test evidence | **Development/pilot**; no App Store, Play Store or Windows-store distribution claim |
| Tenant privacy, security and audit | `routes/auth.ts`, access-policy modules, audit routes | Positive/negative role tests, own-data vs other-school denial | **Unfinished assurance**; full POPIA/Botswana legal and security review required |

### What has actually been browser-tested

As of **22 November 2026**, an isolated Render preview was exercised with the fictional role `cabo_learner_south_a`: sign-in, learner dashboard and sign-out succeeded. **Learning stages and milestones were zero in that deployed preview.** The expanded source fixtures in PRs after this check are not yet proof of deployment, seeding or full end-to-end feature coverage.

### Minimum evidence for an externally shareable claim

For each capability capture: (1) branch/commit SHA; (2) deployed service and environment; (3) date/time; (4) test account role; (5) exact test steps and observed result; (6) screenshot or scrubbed HTTP evidence; (7) negative/unauthorised-access test; (8) open bugs, feature flags and dependencies; (9) reviewer/sign-off. Keep learner screenshots synthetic and anonymised.

**Do not claim:** real pilot outcomes, reduction in dropouts, percent improved attainment, deployed national integration, legal compliance, government endorsement, school accreditation, official enrolment transfer, certified qualifications or commercial traction until independently verified.
