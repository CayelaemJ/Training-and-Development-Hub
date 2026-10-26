# CABO ZA/BW: first school-scoped learner read endpoints
**Draft engineering control — 26 October 2026**

## New API
- `GET /api/organizations/:orgId/institution-records/me` returns only **the authenticated user's own** enrolments for **that exact school**. It deliberately does not aggregate guardian invitations, learner identifiers from other schools or cross-border transfer requests. Empty results do not leak other schools' learners.
- `GET /api/organizations/:orgId/report-issuance/me` returns only the authenticated learner's issued reports from the named school, never cross-school data.
- Both routes run after the per-school country, evidence, transfer and expiry gate in stacked PR #68. The route queries independently filter by school and learner, preventing an authorised school's clearance from becoming permission to inspect other schools.
- The legacy `/api/institution-records/me` and `/api/report-issuance/me` aggregate routes remain blocked by PR #68's unscoped-sensitive guard.

## Remaining work before consumer/client release
- Existing Institution Records web page still uses the **old, blocked** aggregate route and global guardian/transfer paths. Update web and Flutter clients to use the new school-scoped endpoints, with an accessible way for authenticated users to select only their actual schools, a partial-results state and country-appropriate messages.
- Native parent/guardian and transfer flows need school-specific provenance and country clearance for both source and destination. Record a relationship's school instead of assuming a global invitation conveys privileges across countries.
- Background jobs, uploads, generated AI content and cross-country reporting are not covered by this new route. Test egress restrictions before any Botswana production learner data.
- Add real database/integration tests with 2 ZA schools, 2 BW schools, cross-tenant members, revoked clearance and multiple school membership. Static contract tests and CircleCI build **alone do not establish data isolation**.

## Order and release status
This PR is stacked on #68, which itself depends on #62. Apply reviewed staging migrations from #62 and #68 before using the new routes. All PRs are draft. No official verification, privacy certification, real school deployment, or production migration is implied.
