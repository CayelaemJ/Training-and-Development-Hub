# CABO Passport: three strictly separate trust layers

Part of issue #43 and PR #44.

| Layer | Storage | Who writes it | Meaning |
| --- | --- | --- | --- |
| 1. Practical skill evidence | passport_competencies | Learner | Self-reported skills, demonstrations, projects and supporting links |
| 2. AI interpretation | passport_ai_interpretations | CABO AI service, upon learner request | Optional reflection, practice suggestion and uncertainty; never authoritative |
| 3. Human-reviewed achievement | passport_achievement_reviews + passport_achievement_audit | Authorized institution staff following explicit learner request | Institution-specific review with named reviewer, written reason, timestamp, revocation |

## Non-interchangeable rules
- AI cannot create or modify a human review. No AI prompt or request body can set verification status, reviewer, grade, or qualification.
- Human verification is a separate, authenticated assessor/admin/owner decision, never a model prediction or a self-attestation. Reviewers cannot approve their own work. Teachers, parents, unrelated organizations and members outside the institution cannot approve.
- Approval is **not an assertion of formal SAQA accreditation**. Organization membership is a permission boundary, not proof the person or institution holds an external qualification.
- A learner explicitly selects the single practical item and institution to review. Reviewers do not receive the full Passport. Current employer-facing APIs disclose none of the three layers.
- Learners may contest AI interpretations (without changing practical evidence), revoke review consent, and remove owned practical evidence. Human decisions include append-only audit actions while the record exists.
- Human verification requires a substantive written note, human reviewer identity, review time and validated state transition. Database CHECK constraints and account-scoped application routes both enforce this.
- The AI layer includes model, prompt version and SHA-256 digest of the evidence snapshot to expose provenance. It is labelled as fallible and cannot be presented as a verified skill.

## API
Practical evidence: existing /api/learning-passport/competencies endpoints.
AI interpretation: POST /api/learning-passport/competencies/:id/interpret and PATCH /api/learning-passport/interpretations/:id/review.
Layered private view: GET /api/learning-passport/trust-layers/me.
Learner human-review request: POST /api/learning-passport/achievements/requests.
Human reviewer queue: GET /api/organizations/:orgId/passport/reviews.
Human decision: POST /api/organizations/:orgId/passport/reviews/:id/decision.
Owner withdrawal: POST /api/learning-passport/achievements/:id/withdraw.

## Migration order on backed-up staging first
1. node lib/db/scripts/migrate-learner-support.mjs 20261022_lifelong_passport_foundation
2. node lib/db/scripts/migrate-learner-support.mjs 20261022_passport_trust_layers

The later migration is additive and does not rewrite existing practical evidence. Both SQL files have replayed successfully on an isolated Neon validation branch, but execution through the versioned checksum migration runner and live staging API remain separate release gates. Nothing here implies production migration.

## Test and release gates
- node --test artifacts/api-server/src/tests/*.test.mjs
- node scripts/test-passport.mjs
- pnpm run typecheck
- pnpm run build
- Browser/mobile/accessibility and real staging API checks before release

The passport integration test uses fake AI and synthetic accounts to test trust boundaries, role checks, duplicate requests, verified/revoked transitions, cross-user denial and migration replay. It is not a live provider or external accreditation test.

## Outstanding governance
Institutional identity and assessor accreditation validation; learner age/guardian permission checks; formal credential verification; clear human appeal process; export/deletion policies; retention; accessible native onboarding; source-document import, user-reviewed AI extraction and official recognition-of-prior-learning integrations. Do not market institution attestations as nationally accredited qualifications until the required external procedures exist.
