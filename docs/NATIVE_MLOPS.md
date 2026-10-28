# CABO native MLOps: Learning & Development Hub

The native foundation lives in the application's Drizzle schema and Express API workspace. No standalone MLOps vendor is mandatory.

## Initial scope
- Organisation-scoped model versions and approval metadata.
- Organisation-scoped, aggregate model evaluations and operational telemetry.
- Human-reviewed grading evaluation with normalised error, agreement rate, and review frequency.
- Fail closed when marks are invalid or evaluation sample sizes are insufficient.

## API and rollout
- `GET /organizations/:orgId/mlops` returns tenant-scoped model versions, aggregate evaluation results, and bounded telemetry summaries.
- `POST /organizations/:orgId/mlops/models` registers a model in `shadow` state; only organization owners/admins can register one.
- `POST /organizations/:orgId/mlops/models/:modelVersionId/evaluations` accepts numeric, non-identifying AI/educator mark pairs and persists aggregate metrics only. Evaluation is available to owners, admins, teachers, and assessors; it cannot approve or promote a model.
- `ENABLE_MLOPS_REGISTRY` must be `true` before these routes or exam-marking telemetry access the new tables. It defaults off, so deploy the additive migration first and verify tenant tests before enabling it.
- Operational events store only organization, model key/version, event type, bounded duration, and outcome. They omit learner IDs, answers, prompts, model output, arbitrary metadata, tokens, and cost estimates.

## Privacy and governance
Do not store pupil identities, free-text answers, health records, sports medical information, or raw prompts in operational events. Keep academic marks and learner development data in their existing role-protected domain models, not in global monitoring tables. Do not use pupil data to train external providers without an appropriate legal basis, permissions, contracts, and documented retention rules. Educator decisions always supersede AI grading suggestions.

## Next integration stages
1. Test `lib/db/migrations/20261028_mlops_foundation.sql` on the isolated Neon branch. Do not apply it to a production/pilot branch or use `drizzle-kit push`.
2. Complete institution-scoped telemetry review, route-level RBAC regression tests, and a synthetic educator review flow before enabling the feature flag in Render.
3. Add sports and extracurricular progress evaluation only with age-appropriate, coach-reviewed metrics and a separate privacy review.
4. Add version approval, promotion, and rollback as a separate audited phase. An evaluation pass alone cannot approve or promote a model.
5. Expose read-only MCP tools to Claude/ChatGPT and strictly authorized write operations.

Run `pnpm run typecheck && pnpm run build`. A production deployment requires explicit database migration, access-control tests, and privacy review. A model's 'passed' evaluation must never by itself authorise a high-stakes academic action.
