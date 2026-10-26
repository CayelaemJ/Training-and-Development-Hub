# CABO ZA/BW — school-scoped learner attendance
**26 October 2026 | Draft, stacked on PR #72**

Adds `GET /api/organizations/:orgId/attendance/me` with independent server-side filters for organisation ID and the signed-in learner. It projects only attendance day and status; teacher notes, attendance recorder identity and other schools' records are excluded. The stacked country clearance middleware checks the school before the handler executes.

The existing `GET /api/school/attendance/me` combines all schools and remains rejected under the strict country pilot release gate; web/native clients must explicitly select an authorised school and use the scoped endpoint.

**Deployment blocker:** Do not merge or deploy until PRs #62, #68, #72 are reviewed, CircleCI tests are green, staging DB migrations/backups succeed, teacher/guardian/learner browser and native regression tests pass, and child processing + cross-border transfer evidence is approved. This endpoint does not itself certify POPIA or Botswana DPA compliance.
