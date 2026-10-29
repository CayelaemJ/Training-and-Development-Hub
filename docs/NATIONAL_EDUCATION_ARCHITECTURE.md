# CABO National Education-to-Talent Architecture

> **Product identity:** CABO Learning Hub is a [Connected Education and Lifelong Development Platform](PLATFORM_IDENTITY.md), not merely an LMS. This document is a **target architecture**, not evidence of accredited national interoperability, government recognition or live cross-border data sharing. Institution authority, privacy and independently verified integrations remain mandatory.



## Strategic objective
One lifelong CABO person identity, many time-bounded verified education enrolments, and explicit purpose-limited disclosure grants. Data remains attributable to its institutional source; an institution never unilaterally edits another institution's certified results.

## Current South African environment (October 2026)
The DBE already operates/modernises SA-SAMS and LURITS for learner tracking. CABO has no authority to import national child records, act as LURITS, or claim governmental accreditation. Seek formal DBE/PED/EMIS agreements, approved exchange specifications and an evaluated lawful basis before importing identifiable data. First implementation must use dummy accounts.

## National hierarchy
CABO platform governance is distinct from public educational authority:
National DBE -> Provincial department -> District -> Circuit -> School -> Grade -> Class.
A national or district title is not enough to obtain children’s identities, psychological data or family contact records. Require signed scopes, delegated authority, access reviews, context-specific purposes, aggregated reports and independent oversight.

## Plug-and-play institution onboarding
1. Invite or register institution in pending state and select institution type, province, district, circuit, curriculum, term calendar and languages.
2. Verify institution with official registration records, authorised personnel and admin identity checks.
3. Choose a managed template: ECD/Pre-primary, Primary, Secondary, Combined, Special, Independent, TVET or University.
4. Import test CSV using a staged, validated mapping and report rejected rows; never overwrite authoritative records silently.
5. Run deduplication and human adjudication; preserve external identifiers only after verification.
6. Onboard staff through role requests, course assignments and acceptance, not global account lookup.
7. Invite learners/parents through child-safe identity/guardian verification and minimum-necessary access.
8. Configure timetables, attendance, school years, subjects, reporting, promotions, transfers, messaging and authorisations.
9. Maintain signed provenance, consent/legal authority, immutable audit history, export and eventual offboarding.
10. Enable officially sanctioned exchange to EMIS / SA-SAMS / LURITS only with department-approved interface contracts.

## A single person record
- Globally unique random CABO person ID, independent of school.
- Verified aliases for permitted external IDs (never public national IDs); source, verification date and scope attached.
- Enrolments are per institution and year, can transfer, and retain provenance.
- Guardian relationships have verification state and time-limited permissions; links alone are not sufficient.
- School-issued assessments/report cards are sealed and versioned; issued records may be superseded with traceable corrections.
- Qualifications wallet remains subject to accreditation, issuer verification and digital signing.
- School stage development observations are support information, NOT psychometric labels.
- Consent-based professional portfolio begins when age-appropriate; default is no employer access.
- Export to CV and applicant tracking via candidate-approved, revocable, time-limited shares.

## Institution-specific flows
**Pre-primary RR–R**: play-based development, age-appropriate observations, caregiver communications, early support (not ranked scoring).
**Primary 1–7**: foundational literacy/numeracy, curriculum, attendance, class assignments, intervention plans, transition readiness.
**High school 8–12**: pathways, subject selection, credits/results, moderation, subject changes, examination scheduling, bursaries, university readiness.
**Tertiary**: programmes, applications, prerequisites, registrations, module credits, academic standing, graduations, certified transcripts. Separate registrar-specific business logic is mandatory.

## Talent network
Verified employers see public or explicitly disclosed professional skills, verified qualifications and work samples. Candidate-initiated messaging and opt-in employer contact; anti-spam, abuse reporting, blocking, candidate privacy and age eligibility. No uncontrolled recruitment profiles of minors. Psychometric reports require licensed/validated instruments, practitioner oversight, bias monitoring, security and separate explicit access.

## Prioritised technical milestones
1. Enforced per-organisation authorisation throughout legacy routes, production-grade identity, stage-scoped school portal, private records; independent role E2E.
2. National reference directory with school registry provenance, no fabricated official verification, institution claim workflow, circuit/district structures.
3. Academic year rollover, classes, promotions, admissions, attendance, scheduling, reporting, guardian authorisation.
4. Data quality import pipeline, safe identifiers, duplicate resolution, outbox events, offline queues, notifications, audit and integrations.
5. Tertiary registrar domain and credential wallet / signed issuance.
6. Candidate-controlled adult talent profile, consent grants, recruiting and appropriate assessment services.

## External requirements
DBE and provincial approvals; SA-SAMS/LURITS exchange agreements and validation; verified institutions; POPIA lawful basis/children's processing; security, DPIA, accessibility, disaster recovery, support and data-residency evaluation. Until signed and tested, CABO is a pilot, not a national public learner register.

## Success metrics
Institution onboarding time; duplicate identity rate; import rejection/error rate; grade/report accuracy; attendance sync success; staff hours saved; parent response rates; learner and teacher usability; independent security results; authorised credential verification and successful candidate-controlled progression.
