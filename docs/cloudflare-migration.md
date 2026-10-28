# CABO Learning Hub - Cloudflare Direct Upload migration

## Current state
This is a **build-only and security-review** branch. The Cloudflare account has a Direct Upload Pages project named `cabo-learning-static`; it does not require the broken Cloudflare GitHub App integration. This repository change does **not** deploy or change production traffic.

The static build pipeline produces `artifacts/training-platform/dist/public` using:

```sh
corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm install --frozen-lockfile
pnpm run typecheck:libs
node --test scripts/cloudflare/oidc-origin.test.mjs
pnpm --filter @workspace/training-platform run typecheck
PORT=10000 BASE_PATH=/ pnpm --filter @workspace/training-platform run build
test -s artifacts/training-platform/dist/public/index.html
```

After functionality, authentication and privacy checks pass, a reviewer can deploy via Wrangler with a narrowly scoped `CLOUDFLARE_API_TOKEN` configured as a secret:

```sh
npx wrangler@4 pages deploy artifacts/training-platform/dist/public --project-name=cabo-learning-static --branch=main
```

## What must be migrated, not bypassed
Authentication, OIDC callback and protected learner API remain on the server. The frontend must NOT be publicly promoted until end-to-end login, school/tenant isolation, guardian consent, CSRF and API origin tests pass.

Use a fixed and controlled API upstream if transitional. Never put credentials or arbitrary origin URLs in client JS. Protect sessions, cross-origin cookies and OAuth callbacks against the Cloudflare hostname.

## No cutover
- Render remains the canonical runtime and rollback target.
- Database, storage, OAuth, email and payments stay in their currently functioning services.
- Do not claim a full migration from a static frontend build alone.
- Do not merge or change DNS until CI, synthetic demo flows, unauthorized access and release checks pass.
- **NewChanges is separately scoped for Cloudflare migration:** a read-only public preview now exists, but its active Render service must remain untouched. This Learning Hub branch must never change NewChanges infrastructure.

## OAuth / Cloudflare origin boundary (2026-10-28)
This branch introduces `trustedOidcRequestOrigin` and corresponding negative
tests to prevent arbitrary request `Host` or `X-Forwarded-Host` values
from determining OAuth login/callback/logout redirect URLs.

Only exact trusted origins from `CABO_ALLOWED_ORIGINS`,
`RENDER_EXTERNAL_URL` and other existing explicit trusted environment
settings are accepted. Proxy headers are considered only when
`TRUST_PROXY_HOPS=1` is set. Invalid/multi-valued headers fail closed.

Before using Cloudflare for real authenticated sessions:
- Set the actual Cloudflare hostname in `CABO_ALLOWED_ORIGINS` on an
  **isolated staging backend**, not the production Render service.
- Register the matching exact callback and logout URLs at the OIDC provider.
- Verify configured trusted proxies cannot pass attacker-controlled forwarded
  host/protocol headers from arbitrary browser requests.
- Revalidate login, logout, same-site cookies, CSRF, tenant isolation, transfer
  flows, synthetic learner data and protected endpoints.
- The frontend-only Cloudflare build remains **unpublished** until these pass.

Do not reuse production credentials to validate these test flows.
