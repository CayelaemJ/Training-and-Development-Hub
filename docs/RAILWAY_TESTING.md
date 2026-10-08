# Railway isolated testing (CABO Learner Hub)

## Environment

This project is intentionally separate from all existing CABO Solutions and EFS deployments. PostgreSQL is provisioned inside the test Railway project and referenced by the API service via `DATABASE_URL=${{Postgres.DATABASE_URL}}`. Do not copy database credentials from any existing environment.

A single API Railway service serves the built React frontend and Express API on the same origin. The React bundle is built under `artifacts/training-platform/dist/public`, and the API's `app.ts` serves it after the `/api` routes.

Build command:
```sh
pnpm install --frozen-lockfile && PORT=3000 BASE_PATH=/ pnpm --filter @workspace/training-platform run build && pnpm --filter @workspace/api-server run build
```

Start command:
```sh
pnpm --filter @workspace/api-server run start
```

Health check: `/api/healthz`.

## Schema setup

The isolated **new** PostgreSQL database uses a `pnpm --filter @workspace/db run push` pre-deploy command for an initial development-only test. Production databases must instead use reviewed versioned migrations and backup/rollback procedures. NEVER point this test service at existing EFS production PostgreSQL or MySQL data.

## Critical authentication blocker

The current app uses Replit OIDC (`ISSUER_URL` defaults to `https://replit.com/oidc` and `REPL_ID` is passed as the OIDC client ID). A valid Railway-compatible identity provider/client configuration is still required for a successful login. A passing health check or UI load does **not** prove logins work. Do not invent or copy an ID/client secret; complete identity provider registration or replace the authentication implementation before testing school, guardian and other protected workflows.

## Required Railway security configuration

- `ENABLE_EMPLOYER_ACCESS_PILOT=false`
- `NODE_ENV=production`
- Use a newly provisioned, private `DATABASE_URL` reference.
- Keep database public TCP access disabled by default.
- Provide a working identity-provider client registered for the **test domain** before end-to-end auth testing.
- Object storage and AI features require appropriately scoped service credentials.

## Verification

Check Railway app deployment status, UI home page, `GET /api/healthz`, database schema creation, unauthenticated access rejection, and then (after auth setup) two learner accounts, two institutions, guardian invitations and cross-tenant data isolation. Do not expose child records to employers or enable paid-profile access until safeguarding and billing requirements pass.
