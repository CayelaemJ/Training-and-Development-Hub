# CABO Learning Hub — Runtime country-data release gate
**26 October 2026 — STACKED DRAFT — NOT CLEARED FOR LIVE SCHOOL DATA**

## Why this PR exists
Country tagging in school setup does not prevent learner data from being processed. This stacked change adds a **separate school-specific release register** and middleware which requires a current, same-country clearance record before letting organisation-scoped data routes pass. It prevents a school admin from unilaterally clearing their own school using the setup UI.

## Transfer and Botswana copy evidence
- Each clearance row includes `transfer_state`: `unreviewed` (deny), `no_transfer` (reviewed finding), or `approved_transfer` (reviewed legal mechanism). A nonempty internal transfer assessment reference is mandatory.
- For **Botswana approved transfers**, a nonempty `botswana_local_copy_reference` and actual timestamp `botswana_local_copy_verified_at` are mandatory before runtime approval. A reference/timestamp must point to independently verified, safely retained evidence — they do **not** themselves create an in-country copy.
- For `no_transfer`, confirm no foreign access by cloud hosting, AI inference, backup, analytics, email, mobile SDKs or support vendors; storing a string `no_transfer` does not make the claim true.
- This stricter internal rule applies for Botswana transfers where DPA 2024 s74 actually applies. Botswana counsel must classify any circumstances outside its legal scope. Do not defeat the gate by misclassifying overseas transfers as local.

## Safe deployment flag
The middleware is **disabled by default** and only mounted with `CABO_COUNTRY_PILOT_ENFORCEMENT=true`. This avoids unexpectedly breaking existing Render pilot routes when source code merges. No country-controlled real learner pilot is allowed with the flag off; enabling requires both staged migrations, signed evidence and full 2-country E2E regression testing. The flag **does not** constitute legal clearance.

## Integration and default behaviour
- This PR depends on the country schema and `country_code` migration in **PR #62**.
- **Hard fail-closed**, not a silently disabled flag: unknown countries, missing records, expired/revoked/mismatched clearances, malformed organisation IDs and database failures deny protected data routes.
- `GET/PUT /api/organizations/:orgId/setup` remains accessible to authorised institution managers so they can request classification. A draft/submitted state alone does not permit data release.
- Before country clearance, organisation-scoped data routes return HTTP 409; unavailable database/old schema returns HTTP 503.
- High-risk routes without a server-authoritative organisation ID are blocked for the country-pilot release: `/api/institution-records`, `/api/learner-journey`, `/api/guardian-relationships`, `/api/native/mobile/parent`, `/api/my-assignments`, `/api/learner-passport`, `/api/materials`, `/api/quizzes`, `/api/written-exams`, `/api/storage` and others listed in `schoolDataReleasePolicy.ts`. Refactor them to attribute each data row to a school and verify the clearance per data item.
- The gate is NOT a substitute for per-user role/guardian authorization, data minimisation, school accreditation or contract/legal review.
- A valid `evidence_reference` and `authorised_by` must be established **out of band** by accountable legal/privacy/operations reviewers. This PR intentionally provides no app route to self-approve.

## Operational release order — mandatory
1. Implement and merge PR #62 **only after** qualified ZA/BW privacy counsel validates the legal matrix and the country setup migration has passed staging. Test old/null rows.
2. Backup and rehearse restoration in disposable staging; apply reviewed `lib/db/migrations/20261026_institution_data_clearance.sql` before building/deploying this PR. No `push-force`.
3. The new clearance register starts empty (all schools blocked). Write no approvals without documented, signed evidence, institution approval, child processing lawful basis, all subprocessor and transfer details, and operations ownership.
4. For Botswana where s74 applies, prove an encrypted, up-to-date, accessible in-country copy of transferred personal data; verify restoration, backup, data-access and deletion obligations. Retain proof of transfer mechanism separately.
5. Run CircleCI unit/contract tests and 2-country, 2-school E2E tests; use synthetic fixtures to test one allowed school and denied states for different school, legacy NULL, expired, revoked and mismatched country.
6. Rework unscoped routes to use an authenticated school/data provenance, not user-supplied `X-Country` or `organizationId` alone. Ensure ALL relevant services, cron jobs, AI prompts, uploads and external providers enforce scope.
7. Staging regression for web, Android/iOS, teachers, guardians, uploads, assessments and provider failures. Check latency/cost for one clearance lookup per request and add safe caching only with reliable invalidation.
8. Obtain legal + school + security + deployment owner sign-off and migration rollout plan **before** merging or deploying. Without these, a merge would block legitimate operations, and it would still not establish full country compliance.

## Remaining bypass/coverage inventory — separate follow-up
- Self-scoped report and guardian routes are either checked by explicit organisation ID or blocked pending provenance refactor.
- Background jobs, object-storage direct uploads, signed download URLs, AI provider calls, custom report exports and independent API instances bypass this Express middleware unless separately integrated.
- Public training and opportunity endpoints must be reviewed to distinguish safe generic data from personal school-origin data.
- Current full-route inventory and integration testing are **not complete**. Do not mark issue #63 resolved based solely on this PR.

## Evidence needed for a clearance entry
Per school: actual legal entity and country, authorised signatory, dated processing agreement, jurisdiction-specific privacy assessment, children's lawful basis and guardian workflow, purpose/retention schedule, cloud/AI supplier matrix and cross-border approvals, Botswana local-copy proof where applicable, completed forbidden-action E2E suite, signed security review, evidence reference, authorising reviewer and expiration/review date. Evidence must be protected off-repo, with only an opaque internal reference in the database.

This change is a technical enforcement scaffold, not a regulator or legal opinion.
