# Environment, Deployment and Test Plan

## Prerequisites

Node 24, pnpm, PostgreSQL, working session authentication and normal application deployment environment. Existing OpenAI key is only needed for written-exam generation and AI marking, not for this phase's voluntary potential profile.

## Development

1. `pnpm install --frozen-lockfile`
2. Inspect Drizzle changes in `lib/db/src/schema/potential.ts`.
3. Apply reviewed schema changes against an isolated development PostgreSQL instance. The repository's `pnpm --filter @workspace/db run push` is for development only; prefer explicit reviewed migrations for production.
4. `pnpm run typecheck`
5. `PORT=5000 BASE_PATH=/ pnpm run build`
6. Launch API and frontend using README commands.
7. Sign in with multiple user accounts and two separate organizations.

## Configuration

`DATABASE_URL`: PostgreSQL connection; `OPENAI_API_KEY`: existing AI examination features; `PORT` and `BASE_PATH`: build and preview tools. `ENABLE_EMPLOYER_ACCESS_PILOT` defaults to off. **Do not enable for public production** until all safeguards in PRIVACY_AND_CONSENT.md pass.

## Required tests

- Private profile read/update and separate-user denial.
- Evidence creation, deletion and subject isolation.
- Org admin publishes opportunities; learner or stranger denied creation.
- Pilot-disabled employer access and profile reads must return 503.
- When explicitly testing in an isolated adult-consent environment: pending request, denial, approval, expiry and revocation; employer org mismatch forbidden.
- Consent status transitions must not be overwritten by an unrelated actor.
- Excluded fields (school grades, academic records and private reflections) must never appear in employer disclosure.
- Cross-company request IDs must return no profile.
- Existing written exams, organisation management, academics and CABO logo remain functional.
- Log sanitisation, rate-limiting and request throttling before rollout.

## Release plan

Implement in a feature branch; require CI success, human review, database migration rehearsal, backup and rollback, test environment E2E validation and privacy sign-off before production merge/deploy. CI typecheck/build passing is not evidence that these security tests ran.

## Rollback

Disable `ENABLE_EMPLOYER_ACCESS_PILOT` immediately if any disclosure issue is detected. Keep an auditable deployment rollback. Do not drop tables containing user data without approved export/retention analysis.
