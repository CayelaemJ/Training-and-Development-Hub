# CABO Learning Hub — ZA / BW release gates
**26 October 2026 — PENDING, NOT CLEARED FOR REAL LEARNERS**

## Additive code in this iteration
- New optional `institution_setup.country_code` stores explicit ZA/BW jurisdiction. Existing rows remain NULL to avoid assuming a country.
- Setup UI includes country selection; it is locked after first classification because switching countries requires a reviewed export/migration procedure.
- Drafts may be saved with NULL or an explicitly selected country. For `status=submitted`, policy requires classification and country-specific review attestations.
- Botswana setup submissions require the extra `CABO_BW_LOCAL_TRANSFER_COPY_VERIFIED` flag. **An environment flag is an attestation, not real storage proof.**
- Client/legal response always reports `legalCertification:false` and `readyForOfficialVerification:false`. Profile submission is internal review, not permission for real student data.

## Required configuration for internal institution-profile submission
ZA: `CABO_ZA_INSTITUTION_AUTHORITY_REVIEWED`, `CABO_ZA_CHILD_DATA_LAWFUL_BASIS_REVIEWED`, `CABO_ZA_CROSS_BORDER_TRANSFERS_REVIEWED` all exactly `true`.
BW: `CABO_BW_INSTITUTION_AUTHORITY_REVIEWED`, `CABO_BW_CHILD_DATA_LAWFUL_BASIS_REVIEWED`, `CABO_BW_CROSS_BORDER_TRANSFERS_REVIEWED`, `CABO_BW_LOCAL_TRANSFER_COPY_VERIFIED` all exactly `true`.
Do not set these based on a manager's unsupported assertion. Keep them off without signed evidence. A school setup submission is NOT a legal permission to accept learners.

## Migration order (requires review and staging)
1. Backup and verify restore of a disposable staging database; record migration diff.
2. Review `lib/db/migrations/20261026_country_jurisdiction_setup.sql` for column + CHECK constraint; apply explicitly in staging.
3. Run unit tests (including countryCompliancePolicy.test.mjs), typecheck and build, then browser setup flow tests.
4. Run against an existing legacy institution with NULL country; it must remain unclassified until an authorised administrator selects one.
5. Test ZA -> BW and BW -> ZA change rejection; test unauthorised users cannot update setup.
6. Only after review: schedule backup/rollback window and a separately approved production migration. Do not use `push-force`.
7. Confirm and classify all production institutions; do not interpret blank country as SA.

## TRUE live-learner release blockers (not solved by this PR)
- **Hard global enforcement**: every user creation, invite, upload, AI prompt, assessment, guardian report, export, telemetry and deletion flow must enforce tenant country policy. Existing API routes have NOT yet been proven to do this. **Do not run real BW learner trials yet.**
- Botswana in-country copy and lawful export pathway where applicable, including backups; SA POPIA transfers where applicable.
- Per-country DPA, school approval, privacy notice, lawful processing and under-age authorisation.
- Secure institutional role scoping, two-country end-to-end tests, child-data minimisation, human AI review.
- Breach playbook: applicable Botswana 72-hour personal data notice plus South African POPIA breach rules; cyber-critical-infrastructure classification if relevant.
- Verify provider subprocessors (Groq and other AI, hosting, databases, storage, logging/email), residency and onward transfers.
- Local curriculum validation and educational claims; no official accreditation without authority.
- Incident response and backup/restore drills, mobile offline-data persistence review, penetration testing and signing authority.

## Evidence sign-off ledger (all missing by default)
| Country | Institution approval | Child lawful basis | Transfer route | Local BW copy where relevant | School/tenant isolation E2E | Counsel | Status |
|---|---|---|---|---|---|---|---|
| ZA | Missing | Missing | Missing | N/A | Missing | Missing | BLOCKED |
| BW | Missing | Missing | Missing | Missing / applicability review | Missing | Missing | BLOCKED |

Always review current regulator guidance before lifting any gate. Never show compliance-certified badges or claims without legally and technically supported evidence.
