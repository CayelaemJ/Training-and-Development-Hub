# CABO Learning Hub — South Africa and Botswana compliance applicability
**26 October 2026 | WORKING CONTROL REGISTER | NOT LEGAL ADVICE OR CERTIFICATION**

## Scope and key fact
For SA schools, assess POPIA (Act 4/2013), PAIA (Act 2/2000), relevant consumer/online service obligations and school/child safeguarding. For Botswana, assess the **Data Protection Act 2024 (Act 18 of 2024), commenced 14 January 2025** (not the repealed 2018 Act), children's safeguards, school arrangements and cyber incident obligations where in scope. The primary location of the school is only one factor: CABO may have independent controller/operator roles and its suppliers may transfer data onward.

## Working applicability matrix
| Control | South Africa (ZA) | Botswana (BW) | Evidence needed |
|---|---|---|---|
| Core privacy | POPIA: purpose, lawful basis, minimisation, security, transparency, retention | DPA 2024: corresponding processing principles and controller/processor duties | Feature-by-feature record of processing, controller/operator schedule |
| Children | POPIA ss 34–35: generally restricted without competent-person consent or a statutory authorisation/exception; section 35(2) authorisation is not universally required | DPA 2024 s 29: under-16 consent rules for information-society services offered directly to children, with context and exemptions needing review | Age band policy, parental authority, school permission, notices, withdrawal and evidence |
| Cross-border | POPIA s 72; assess s 57 prior authorisation in specific higher-risk contexts | DPA 2024 Part XIV ss 74–79: transfer basis; **s 74 Botswana copy for in-scope transfer by controller/processor in Botswana** | Data flow map, vendor country, safeguards, local secure copy evidence where applicable |
| Breach handling | POPIA s 22 Regulator and data-subject notification as soon as reasonably possible when applicable | DPA 2024 ss 63–64: risk-based regulator/subject notifications; generally where feasible within 72 hours for qualifying controller notice | Country-specific escalation clocks, reporting contacts, tested drills |
| Rights | POPIA access, objection, correction, deletion subject to lawful limits; PAIA manual applicability | DPA 2024 access, rectification, erasure, objections and other rights | Verified requests workflow, ID verification, institution routing, retention/legal holds |
| High-risk profiling | POPIA automated decision-making protections, children and consent conditions | DPA 2024 safeguards for automated decisions, data minimisation and children | AI impact assessment, human intervention, model/vendor inventory, no final automated academic decisions |
| School law | SA Schools Act, education departmental rules and actual public-school procurement/data agreements as applicable | Education Act and Botswana Ministry of Child Welfare and Basic Education rules/EMIS as applicable | Authorised pilot school letters, valid academic curriculum/certification claims, school data contract |
| Security | POPIA s 19 safeguards; Cybercrimes Act and other context-sensitive rules | DPA 2024 security; Cybersecurity Act obligations only where applicable/designated | Security threat model, RLS/tenant checks, encryption, CSIRT categorisation advice |
| Commercial | ECTA/CPA and contract/unfair-terms/marketing/consumer law as applicable | Applicable Botswana electronic commerce, consumer, contractual and procurement law — qualified review needed | Jurisdiction-specific terms, VAT/tax advice, cancellation/refund/support channels |

## Botswana-specific legal risk: export + local copy
The wording of DPA s 74 focuses on transfers **from a controller or processor in Botswana**. Establishment and extraterritorial application may alter obligations. Do NOT treat all Botswana-based learners automatically as triggering an identical copy obligation without counsel determining the scope. To fail closed, CABO's school submission gate requires an affirmative `CABO_BW_LOCAL_TRANSFER_COPY_VERIFIED` attestation where a Botswana pilot is proposed. That is an **internal readiness gate**, not evidence that a local copy exists. Verify actual in-country storage/restore, authorised encrypted access, cost and deletion/retention before any controlled live export.

## Cross-border cases to map
1. Botswana school -> cloud database abroad; Botswana copy and transfer authorisation review.
2. Botswana school -> AI assistant in another country, including prompts, uploads, response logs, telemetry and subprocessors.
3. South African school -> Botswana-hosted processing; POPIA s 72 and operator terms.
4. Cross-school/cross-country guardian portals; no shared access merely because a user has multiple schools.
5. SA/BW school -> analytics, crash/error telemetry, email/SMS providers, backups and developer support.
6. Public demonstration -> **synthetic data only**, no real child names, IDs, photos, grades or health notes.

## Status as of 26 October 2026
- Repository has SA-oriented draft notices and an institution DPA draft, but neither is legally approved.
- This change proposes explicit optional country classification `ZA` / `BW`, country-specific setup attestations, and an additive DB migration.
- **NOT VERIFIED**: hosting region(s), provider/subprocessor list, Botswana in-country data copy, institutional authority, legal sign-offs, full API enforcement, actual data subjects' lawful bases, breach drills, device security.
- Do not turn test data into live processing on the strength of this policy module alone. Remaining APIs must be audited for mandatory country readiness enforcement.

## Source links — verified 26 October 2026
- South African Government POPIA: https://www.gov.za/documents/protection-personal-information-act
- South African Information Regulator children's guidance: https://inforegulator.org.za/guidance-notes/
- South African Information Regulator prior authorisation: https://eservices.inforegulator.org.za/priorauthorisation/default.aspx
- Botswana Data Protection Act 2024 / 2025 commencement: https://botswanalaws.com/principal-legislation/data-protection/
- Botswana Government Gazette text of Data Protection Act 2024: https://legacy.dataguidance.com/sites/default/files/botswana-data.protection.act_.2024.pdf
- Botswana child-data and transfer discussion (secondary legal synthesis, not binding): https://lexlint.io/l/bw-data-protection-2024-no-18-2024-s-29-part-vi and https://lexlint.io/l/bw-data-protection-2024-no-18-2024-part-xiv-ss-7
- Botswana Ministry of Child Welfare and Basic Education: https://www.gov.bw/ministries/ministry-child-welfare-and-basic-education

A qualified Botswana lawyer and South African POPIA adviser must validate statutory interpretations, jurisdictional triggers and institution-specific exemptions before live trials.
