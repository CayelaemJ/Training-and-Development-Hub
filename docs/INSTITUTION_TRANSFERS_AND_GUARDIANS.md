# Institution Enrolment, Transfers and Guardians — Pilot

## Scope

This is a controlled first iteration that keeps institution-authored learner records separate from self-reported historical entries. Its name "verified" means **attested by a CABO organisation admin**; it does NOT establish that the school is registered, the student's identity has been legally verified, or that the record is government-certified. Do not present these records as official NSC/IEB certification.

## Schema

- `verified_enrollments`: learner, organisation, stage, academic year, recorder, status, timestamps.
- `school_transfers`: learner-initiated request from existing active enrolment to destination organisation, status, reviewer, dates.
- `guardian_relationships`: learner-initiated invitation to an existing guardian account; guardian may accept or decline.

## Security boundaries

- Enrolment creation/listing requires **owner/admin membership of that exact organisation**.
- A learner must already be a `learner` member of that institution before an enrolment can be attested.
- Only the authenticated learner can initiate a transfer using **their own** active enrolment.
- Only the destination organisation owner/admin can accept/decline. The learner must be registered as a member of the destination organisation before acceptance.
- Transfers do **not** copy grade histories or enrolment records automatically. Historical enrolments remain intact.
- The learner initiates a guardian invitation using an existing account email; that guardian must explicitly accept.
- **Accepted invitations give no parental access to private learner/academic information.** Legal guardian validation and minor consent flows are not yet built.
- Corporate profile disclosure endpoints do not read institution or guardian tables.

## Endpoints

| Method | Endpoint | Caller |
|---|---|---|
| GET | /api/institution-records/me | Learner, own data |
| POST | /api/organizations/:orgId/verified-enrollments | Org owner/admin |
| GET | /api/organizations/:orgId/verified-enrollments | Org owner/admin |
| POST | /api/institution-records/transfers | Learner |
| GET | /api/organizations/:orgId/transfers/incoming | Destination owner/admin |
| POST | /api/organizations/:orgId/transfers/:transferId/decision | Destination owner/admin |
| POST | /api/guardian-relationships | Learner |
| GET | /api/guardian-relationships/incoming | Invited guardian |
| POST | /api/guardian-relationships/:id/decision | Invited guardian |

## Release gates

1. Obtain South African POPIA legal review, assess obligations for processing children's data and ensure appropriate authorisation and privacy notices.
2. Verify a school's legal status before allowing officially verified academic assertions; add issuer audit records and correction/dispute procedures.
3. Design independent child/guardian relationship verification and legal authority rules before providing parental visibility.
4. Review and apply PostgreSQL migrations in staging; backup first and rehearse rollback.
5. Add robust authenticated end-to-end, multi-tenant and concurrency tests for all endpoints.
6. Prevent unrestricted account ID enumeration and unsolicited invitations; add throttling and abuse reporting.
7. Support permissioned formal transfer and attestation with provenance, while preserving historical data and avoiding employer disclosure by default.

## Known limitations

School transfer acceptance does not automatically close or replace source enrolment. Transfer invitation is an administrative workflow rather than formal record movement. No independent school accreditation, legally validated guardian records, grade transfer or billing controls. UI is a pilot experience, not production-certified student information management.
