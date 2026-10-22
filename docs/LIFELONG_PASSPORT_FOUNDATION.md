# CABO Lifelong Learning Passport — integrated foundation

Part of issue #43. Adds to the existing learner journey and identity, without replacing school workflows or altering native PR #42.

Implemented: adult/professional learning context, preferred language, learning goal; private external HTTPS evidence links (arbitrary provider names, no crawling); private self-reported practical competencies with category, demonstration method, 0–4 evidence rubric and optional same-owner supporting link. All data are stored in new PostgreSQL tables and exposed through owner-only endpoints. Neither records nor links are included in employer-facing responses. No intelligence score is computed.

Migration (staging database and backup first):

    node lib/db/scripts/migrate-learner-support.mjs 20261022_lifelong_passport_foundation

Endpoints, all requiring authenticated session:
- GET /api/learning-passport/me
- PUT /api/learning-passport/preferences
- POST and DELETE /api/learning-passport/links
- POST and DELETE /api/learning-passport/competencies

Writes require a trusted browser origin through existing app middleware. Link storage does not fetch remote content. Verification/visibility fields are server-owned, never accepted from clients. Cross-linked evidence must belong to the same user. Reads are no-store. Deletion removes owned links or competencies only; linked competencies retain descriptions but lose the deleted link reference.

Local checks: node --test artifacts/api-server/src/tests/*.test.mjs; pnpm run typecheck; pnpm run build. Full database isolation and browser acceptance checks must pass before merge. Migration must be applied before the new API can serve requests.

NOT included: document/CV/CSV history importer, AI extraction or human approval, credentials/certifications, OAuth syncing, unrestricted platform crawling, employer matchmaking, native parity or human-verified competency levels. Existing material uploads do not imply credential extraction. No claims of production deployment or tested runtime until CI/staging confirms.
