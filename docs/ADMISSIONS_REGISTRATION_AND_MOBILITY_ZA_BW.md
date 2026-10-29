# CABO Admissions, Registration and Institutional Mobility Engine (ZA/BW)

**Design and delivery register — 27 October 2026. DRAFT, NOT DEPLOYED OR LEGALLY APPROVED.**

CABO is a Connected Education and Lifelong Development Platform. Admissions and portability are new services spanning preschool, school, higher education, college, training and adult learners. This first PR adds a *pure policy library and negative regression tests*, not real verification APIs, a live admissions system or country/legal clearance.

## User journeys

### Preschool, primary and high school

1. Parent/guardian starts or joins a draft for a specific authorised school and intake. A child may initiate a draft, but **no school application may proceed to formal submission without a verified, currently authorised legal guardian and purpose-specific consent**. A learner whose guardianship is legally exceptional requires a documented human-reviewed alternative; never silently bypass protection.
2. Collect only documents the actual institution requires (e.g. birth certificate, official prior school report, relevant residence details). Bank statements are **not a default school requirement** and may only be processed if specifically necessary and supported by law/contract.
3. Use private, malware-scanned, rate-limited, short-lived evidence storage, explicit access grants, encrypted temporary files and short-lived review links. OCR/AI may classify or flag mismatches, but never solely authenticate identity, decide admission, invent marks or flag fraud.
4. Verify issuer-attested records via an authorised channel or send for human review. Check registration fees via signed payment gateway webhooks/institution finance with replay protection; uploaded payment screenshots are not settlement evidence.
5. Enforce school authorisation, country release gate, guardian relationship proof, application-specific consent, required evidence and payment clearances in a server-authoritative transaction. Only then may the application become READY FOR HANDOFF; institutional placement remains a human/institutional decision.
6. The school controls its legally required operational contact/emergency details; CABO should not retain duplicate parent identity scans merely because an enrolment was completed.

### College, university and adult study

1. Adult students submit for themselves after age/capacity checks. Minors attending tertiary institutions require legally applicable guardian approval. Unknown age/capacity is not treated as verified adult.
2. Student applies to an authorised programme/campus/intake through an institution-approved connector or a clearly labelled external handoff; CABO cannot assert that the institution received an application without proof.
3. An institution-approved, versioned module catalogue supplies module title/code, descriptive outcomes, official credits and credit system, prerequisites/corequisites, required/elective rules, max load, timetable/campus, dates and published source.
4. AI explains what modules mean, workloads, credits, pathways, electives, double majors and the consequences of switching programmes, **grounded only in official source content**. Deterministic rules calculate prerequisite gaps and totals. Double majors, timetable exceptions and credit exemptions require an academic adviser/registrar; AI never confirms them.
5. Institution confirms registration and may approve a student card or digital credential. Fulfilment supports pick-up or tracked delivery of learning materials and authorised cards, with protected addresses and deletion schedules. Payments, waivers and funding are reconciled independently.

### Easier institutional transfers

1. Learner or verified guardian starts a named source-to-destination request; the user sees exactly which results/records will be shared and consents to that scope.
2. Verify both institutions, their country-specific release status, origin record signatures/issuer claims, any disputes/legal holds, and destination permissions. Never silently transfer all school records.
3. Destination compares curricula, levels, grades and intake capacity; for tertiary it evaluates CAT/RPL and module/credit equivalence against actual approved policies. AI can propose equivalence, not award credit.
4. Receiving institution registrar makes final decision, records reasons, status/appeal options and acknowledgement. Only then update enrolment status, idempotently, preserving legally required original history.
5. Cross-border ZA/BW transfer is off by default until legal transfer mechanism, subprocessor access and Botswana-specific applicability/local-copy obligations are cleared.

## Sensitive-document processing and "self-destruct"

Separate (A) temporary parent/learner ID scans, birth certificates, banking or financial documents and transcripts from (B) minimum durable verification and consent/audit receipts.

- Quarantine uploads in institution-scoped encrypted object storage, use strict MIME/size/malware and access checks, avoid raw PII in Postgres, AI prompts, application logs, analytics, URLs or telemetry, and prohibit default external AI transmission of family documents.
- Purge temporary bytes, derivatives, OCR caches and signed access following completed verification and institutional handoff **only after** pending reviews, appeals, contractual/statutory retention and legal holds have been checked. Revoke URLs, destroy isolated data-encryption keys when appropriate, confirm deletion-worker completion and document backup/vendor retention. Do not promise instantly irrecoverable deletion without evidence.
- Keep minimum legally required accountability records, such as consent version, institution/purpose, check category and issuer, verification date, decision, reviewer, payment transaction reference and deletion proof. Required school contact information belongs with the school and may lawfully remain there; CABO cannot compel schools to discard legally required emergency records.
- To an authenticated, authorised school, the privacy-preserving result may look like **{ "verified": 1 }**. This bit means *only the specified checks have passed for that specific institution, application and purpose*, not admission, permanent identity verification or qualification authenticity by AI. Internally scope a signed, expiring, revocable receipt by institution, applicant, purpose and policy version; never accept a bare 1 supplied by the client.
- Children and parents must have comprehensible privacy notices, access/correction/dispute/withdrawal rights and a secure complaint process.

## Authoritative verification candidates — no integrations claimed

| Country | Authority | Trust boundary |
|---|---|---|
| South Africa | Umalusi / registered verification agencies | Appropriate route for NSC, Senior Certificate and other relevant Umalusi qualifications; not a public register CABO may simply scrape |
| South Africa | SAQA NLRD / VeriSearch | Registered qualifications; access under its own conditions, with exact scoped queries and limitations |
| South Africa | Issuing school/university | Official reports, enrolment and module catalogue only under consent, agreement and source authentication |
| Botswana | Botswana Examinations Council (BEC) | PSLE, JCE, BGCSE certificate/results verification; request-based third-party checks are documented. A public candidate portal is not a CABO API |
| Botswana | Botswana Qualifications Authority (BQA) | Qualification evaluation, awarding body checks, accreditation and NCQF/CAT rules; no automatic award of transfer credits |
| Both | Payment provider / institution finance | Signed, replay-safe webhooks and reconciliation; not screenshots of payment |

Official starting points: Umalusi https://www.umalusi.org.za/services/verification/ ; SAQA https://saqa.org.za/verification-services/ ; BEC https://www.bec.co.bw/index.php/faq-s ; BQA https://www.bqa.org.bw/services/evaluation-qualifications-eq ; BQA CAT https://www.bqa.org.bw/departments-divisions/national-credit-and-qualifications-framework-services-ncqfs . South African POPIA retention and children rules, and Botswana Data Protection Act 2024 (commenced 14 January 2025) need institution-specific counsel review; see existing legal/ZA_BW_COMPLIANCE_APPLICABILITY_MATRIX_2026-10-26.md and legal/ZA_BW_RUNTIME_DATA_RELEASE_GATES.md.

## Architecture and source-of-truth boundaries

The policy library at artifacts/api-server/src/lib/admissionsTrustPolicy.ts is intentionally pure. It does **not** authenticate its inputs. All booleans must eventually come from trusted server-side joins, signed and scoped verification decisions, verified guardian authority, issuer results, settled payment events and the jurisdiction release register. **Never expose this library via a public endpoint where clients can submit their own verified flags.**

Future tables (not yet implemented): intake_applications, preadmission_guardian_consents, encrypted_temporary_evidence_refs, issuer_verification_jobs, institution_course_catalogue_versions, modules, selection_reviews, settled_payment_events, student_registrations, transfer_consents, transcript_disclosures, credit_recognition_decisions, materials_fulfilment and immutable scoped audit receipts. Institution ownership, row-level controls, default deny, expiry, idempotency and deletion/reconciliation jobs are mandatory.

The existing institution transfer pilot cannot currently transport official transcripts, and existing guardian verification depends on active enrolment. Create an independent **pre-admission verified-guardian workflow**; do not treat accepted invitations as authority. Existing admissions routes are university handoff-only, not official submissions. See INSTITUTION_TRANSFERS_AND_GUARDIANS.md.

## Work packages and acceptance gates

**Phase 0 (this PR):** tested fail-closed guardian requirement across all school stages; tertiary unknown age rejected; current purpose-limited consent; unverified issuer/fee blocking; minimal receipt; legal-hold-safe purge decision; source/destination transfer authority; deterministic module credit/prerequisite/double-major adviser flags. These are library-level tests, not live workflow completion.

**Phase 1:** verified institution directory and intake templates, applicant and parent draft portal, authenticated *pre-admission* guardian validation, institution/child-specific permissions, consent and school-jurisdiction clearances. Negative tests: child submits alone, other guardian impersonation, revoked/expired consent, cross-tenant records, invalid institution.

**Phase 2:** temporary evidence processing, approved ZA/BW verifier adapters, manual-review queue, automatic deletion and backup retention evidence, payment integration and webhook abuse tests. Negative tests: malware, forged issuer claims, webhook replay, legal hold, incomplete deletion, AI hallucination.

**Phase 3:** university registrar catalogue, source-grounded AI advisor, academic schedule/credits, signed module registrations, institution-issued card and materials fulfilment with collection/delivery. Negative tests: fabricated course, mismatched catalogue year, credit overload, invalid double major, timetable/capacity conflicts.

**Phase 4:** source/destination institution approved transcripts, parent/learner transfer consent, institution-specific CAT/RPL decisions, optional cross-border transfers, appeals and record lifecycle. Negative tests: revoked disclosure, forged transcript, unauthorised reviewer, duplicate transfer, wrong learner, policy mismatch.

**No-live-data release gate:** independent ZA/BW legal review; child protection/privacy impact assessment; institution and verification-provider agreements; authority and consent verification; country transfer and Botswana copy proof where applicable; RLS/tenant and end-to-end tests; approved retention/backup/deletion proof; CircleCI checks, browser/mobile access, payment staging reconciliation and written institution sign-off. This PR neither clears those gates nor deploys them.

## Product identity

Admissions and institutional mobility expand CABO's *Connected Education and Lifelong Development Platform*. They do not reduce it to a traditional LMS. Update public marketing only after working integrations are verified.
