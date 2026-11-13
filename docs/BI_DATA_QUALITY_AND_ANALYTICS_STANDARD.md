# CABO BI and data quality standard

This standard applies whenever the platform captures, imports, changes, aggregates, or displays learner, school, assessment, attendance, support, or sports data. A value is not ready for analysis just because it passed a database insert.

## Data entry requirements

Every data-entry flow must:

1. **Validate at the server boundary.** Use an explicit schema, enumerations, range checks, date and cross-field rules. Reject malformed values with a field-level explanation; never rely on client-side validation alone.
2. **Normalize before uniqueness checks.** Trim text and identifiers where whitespace is insignificant; use a documented case policy for codes and email addresses. Detect duplicates after normalization and enforce important uniqueness rules in the database too.
3. **Preserve meaning.** Treat zero, false, not applicable, not yet recorded, unknown, and withheld as different states. Do not turn absent data into zero or an empty string unless the field's definition says that is valid.
4. **Keep provenance.** For each operational record, retain the authorized actor, organization, event/observation date, system receipt time, and source/import channel where available. Do not accept actor or tenant identity from the submitted payload.
5. **Make corrections visible.** Do not silently overwrite conflicting learner records or offline replays. Return accepted, duplicate, conflict, and rejected outcomes; require an authorized correction path with a reason and an audit trail for consequential records.
6. **Validate context and ownership.** Check that the learner, school, academic year, course, assessment, and parent/guardian relationship are valid together and belong to the authorized tenant. Apply least privilege and private caching to sensitive records.
7. **Minimize sensitive data.** Collect only fields needed for the learner or operational purpose. Avoid sensitive free-text notes in analytics, logs, AI prompts, and exports unless access and retention are explicitly governed.

## Analysis and dashboard requirements

Every material metric or indicator must have a discoverable definition that states:

- the business question and metric name;
- its grain (for example, one learner-course-period or one school-calendar-year);
- numerator, denominator, inclusion/exclusion rules, and time window;
- treatment of missing, late, duplicate, corrected, and provisional records;
- source and freshness/last-ingested time;
- privacy threshold and applicable authorization scope;
- whether it is operational, provisional, verified, or official.

Do not label a ratio a rate when its expected denominator is unavailable. Show the rate among the recorded observations with that limitation, or show the metric as unavailable. Do not compare groups with materially different coverage without showing coverage. An empty cohort is not a zero-performing cohort. Average metrics only at a declared grain and state whether the aggregate weights learners, courses, assessments, or institutions equally.

## Rollout order

Apply this standard to attendance and academic marks first, then enrollment/admissions and progression, learner support, imports/exports, and sports profiles. Each flow should have: a field dictionary, validation rules, provenance, correction process, metric definitions, access controls, and a named data owner. Existing data is not automatically certified as complete or official by adopting this standard.

## Current implementation notes

- Offline attendance replay trims learner identifiers and notes, rejects duplicate learner/day keys in one batch, and reports accepted, duplicate, conflict, and rejected counts. Existing conflicting records require manual review.
- Attendance summaries expose the selected year, generation time, last recorded ingestion time, record grain, status counts, and the fact that the true attendance rate cannot be calculated without expected learner-days.
- The education command overview retains `attendanceRate` for API compatibility and adds `recordedAttendanceRate` plus a metric definition. Both currently mean present-or-late recorded entries divided by all recorded entries, not attendance divided by expected learner-days.
- This is the initial BI baseline. Other data-entry and reporting routes still need to be reviewed and migrated; this document does not certify existing dashboards or historic data.
