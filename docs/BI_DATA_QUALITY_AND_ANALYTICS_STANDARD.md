# BI data quality and analytics standard

## Purpose
Make CABO reports useful for decisions by showing what was captured, how it was validated, what each metric means, and when the source was last updated. Apply the same rules to API forms, bulk entry, offline sync, imports, dashboards, and AI-assisted analysis.

## Data entry rules
- Validate fields on the server with bounded types, formats, controlled values, and cross-field rules.
- Normalize identifiers, codes, units, and dates consistently; preserve meaningful user-provided text.
- Distinguish unknown, not applicable, not yet entered, and verified values. Never convert a missing value to zero without an explicit metric rule.
- Make batch imports idempotent and report created, already-present, conflicting, and rejected records separately.
- Preserve tenant, authenticated actor, source, and server ingestion time. Keep corrections auditable for high-impact records.
- Enforce the same tenant and role checks for create, update, import, read, and export operations.

## Analysis rules
- Define each metric's meaning, grain, population, period, unit, numerator, denominator, exclusions, source, and refresh time.
- Distinguish recorded counts from rates. Do not calculate a rate without its expected population or event denominator.
- Surface data freshness and reconciliation checks beside the result.
- Measure completeness, validity, uniqueness, referential integrity, and timeliness without logging personal learner content.
- Separate verified observations from estimates, forecasts, and AI recommendations. Include the supporting source and confidence limits.
- For learner analytics, keep access tenant-scoped and use aggregate outputs where possible. Suppress small groups; never infer personal traits or ability from missing or proxy values.

## First implementation: attendance
The attendance sync route validates status/date fields, scopes writes to an organization manager and active learner enrollment, rejects duplicate learner/day keys within one batch, and relies on a unique database index for idempotency. The response reports batch outcomes separately. The summary returns calendar-year record and status counts, ingestion freshness, and a reconciliation check.

The summary intentionally does **not** calculate an attendance rate: the current dataset has attendance events, but not the expected sessions or learner-day denominator. The status counts are not official district statistics.

## Rollout
Issue #177 tracks the full inventory and phased application across other data-entry and analytics routes. Attendance is the initial slice; admissions, academic grades, progression, support, institution records, and external imports still need route-by-route review and adoption.
