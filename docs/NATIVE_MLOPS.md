# CABO native MLOps: Learning & Development Hub

The native foundation lives in the application's Drizzle schema and Express API workspace. No standalone MLOps vendor is mandatory.

## Initial scope
- Organisation-scoped model versions and approval metadata.
- Organisation-scoped, aggregate model evaluations and operational telemetry.
- Human-reviewed grading evaluation with normalised error, agreement rate, and review frequency.
- Fail closed when marks are invalid or evaluation sample sizes are insufficient.

## Privacy and governance
Do not store pupil identities, free-text answers, health records, sports medical information, or raw prompts in operational events. Keep academic marks and learner development data in their existing role-protected domain models, not in global monitoring tables. Do not use pupil data to train external providers without an appropriate legal basis, permissions, contracts, and documented retention rules. Educator decisions always supersede AI grading suggestions.

## Next integration stages
1. Run reviewed database migrations in a disposable Neon branch; do not push a schema blindly to production.
2. Instrument existing AI exam marking with bounded, redacted operational events.
3. Build authenticated institution-scoped evaluator endpoints and educator review UI.
4. Add sports and extracurricular progress evaluation using age-appropriate and coach-reviewed metrics.
5. Add version approval, promotion and rollback with audit trails and tests.
6. Expose read-only MCP tools to Claude/ChatGPT and strictly authorised write operations.

Run `pnpm run typecheck && pnpm run build`. A production deployment requires explicit database migration, access-control tests, and privacy review. A model's 'passed' evaluation must never by itself authorise a high-stakes academic action.
