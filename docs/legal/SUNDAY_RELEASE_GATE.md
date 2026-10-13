# CABO Sunday, 11 October 2026 — Compliance release gates

Status on 10 October: **NOT CLEARED FOR REAL STUDENT / SCHOOL / EMPLOYER PRODUCTION DATA**.

## Evidence-based controls already documented (not independently penetration-tested)
- Employer private profile reads and new consent requests feature-flagged off by default; review runtime environment setting.
- Career application pilot must remain off pending adult/employer and safeguarding review.
- AI marks advisory; human review before high-stakes outcomes.
- Psychometric passport contains unverified development metadata, not licensed validated tests.
- Repository contains server-role scoping design, but independent cross-tenant E2E proof is outstanding.

## Mandatory blockers (do not turn green based on documentation alone)
- [ ] Verify business legal details, Information Officer and official contact; obtain qualified SA POPIA/consumer/employment review.
- [ ] Publish approved privacy notice, appropriate TOS, clear AI use explanation and institution agreements before actual processing.
- [ ] Verify all relevant providers, contracts, jurisdictions, subprocessors, AI retention/training and cross-border protections.
- [ ] Confirm age/competent-person authorisation and validated guardianship, including guardian-vs-institution scoping.
- [ ] Complete identity-secure data access/export/correction/deletion workflow with lawful academic retention and backups.
- [ ] Version acceptance records and implement granular optional consent/withdrawal where applicable; test tracker blocking.
- [ ] Inventory asset/image/font/course-content licenses; check all installed package licenses and lockfile for vulnerabilities.
- [ ] Prove marketing unsubscribe, subscription cancellation and renewal disclosures before activating the relevant features.
- [ ] Independent two-school, two-learner, guardian, teacher, district, employer, superadmin forbidden-action E2E tests.
- [ ] Validate production auth/MFA, upload security, rate limiting, encryption, audit integrity, incident plan, tested restore and alerts.
- [ ] Penetration test and repair material findings; publish no SOC 2 claim or contractual uptime figure without proof.
- [ ] Obtain formal institution approvals before displaying their names/logos as customers or partners.

## Operational release profile until cleared
Use synthetic, non-identifying adult test fixtures. Employer access, psychometric sharing, unmoderated final academic decisions, unverified parent records access, external recruitment and paid renewals remain disabled. Do not merge/deploy as a production compliance certification.

## Exact test evidence to attach
GitHub CI SHA, deployment SHA, environment flag evidence (redact secrets), Playwright/API test logs, database migration/rollback, restore drill result, cookie network traces, license report, provider inventory, legal sign-off and approved policy versions.
