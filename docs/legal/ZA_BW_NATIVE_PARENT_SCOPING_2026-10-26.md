# CABO ZA/BW — native parent reporting scoped to a single school

**Draft engineering implementation — 26 October 2026.** These endpoints are not an authorisation to process live child data.

## Additive API (iOS/Android/Windows)
- `GET /api/organizations/:orgId/native/mobile/parent`: authenticated native guardian overview for only the named institution; returns **only institution-verified, actively enrolled** learner relationships with current school-specific verified events. Pending, unverified or revoked child identities are excluded.
- `GET /api/organizations/:orgId/native/mobile/parent/reports?year=2026`: authenticated native guardian draft progress for only the specified school; each report independently rechecks active enrolment and latest school-level verification.
- Both routes use existing Bearer-native-session requirements **and** school-specific clearance middleware when `CABO_COUNTRY_PILOT_ENFORCEMENT=true`.
- The legacy global `/api/native/mobile/parent` and `/api/native/mobile/parent/reports` remain blocked under strict country pilot enforcement; they are not automatically rewritten to an arbitrary school.

## Client migration / UX gates
- Flutter, iOS, Android and Windows must discover the guardian's **verified eligible school(s)** through a dedicated school-scoped discovery flow and explicitly choose a school before loading private data. Do not guess the child's school from a raw unverified invitation or send a user-controlled country header.
- The existing native app clients still call the global route, so they will receive a block response under strict country enforcement until migrated. Do not activate country-pilot enforcement for real guardian devices yet.
- Do not cache another institution's learner names, drafts, screenshots, or parental relationship data after logout, school switch, revocation or expiry.
- Test multiple verified schools, revoked school clearance, stale guardian verification, offline cache wipe, iOS/Android/Windows functionality and screen-reader access.

## Security limitations
- No per-school guardian discovery API or native-client migration is included here.
- No verification of actual Botswana hosting residency or foreign AI/backups is implied.
- All approvals used in isolated Neon/Render QA are **fictional**; they are not contracts, consent or local-copy proof.
- Keep the rollout opt-in and obtain separate school, child-protection, legal, security and operations authorisation before any live personal-data pilot.
