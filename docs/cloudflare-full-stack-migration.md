# CABO Learning Hub complete application on Cloudflare — migration candidate

## Actual scope
`CayelaemJ/Training-and-Development-Hub` is the source of truth.
This migration targets the Express `@workspace/api-server` and the actual
`@workspace/training-platform` frontend together, using the original
pnpm workspace and build process. It is not a static replacement for
learner, teacher, tutor, parent or administrator experiences.

## Runtime
- `Dockerfile.cloudflare` builds the existing full web + API
  workspace from the `feat/learner-success-loop` production-candidate
  baseline. No `drizzle-kit push`, migrations or seeding.
- `cloudflare/full-stack/worker.mjs` uses Cloudflare Containers to
  run `artifacts/api-server/dist/index.mjs`. The current Express
  server already serves `artifacts/training-platform/dist/public`
  and handles API calls; this preserves same-origin access.
- `wrangler.cabo-full-stack.jsonc` keeps all release switches
  **disabled**; no public Workers subdomain or automatic DNS.
- Worker bindings must be configured for the full production
  database, OIDC, provider keys, upload storage, notification
  services and safe cookie/domain settings. No secrets in Git.
- Cloudflare Containers requires Workers Paid and a Docker-capable
  image build. A Worker-only dry run does not build the image.

## Child-data and access blockers
The Worker deliberately refuses traffic until child-data governance,
tenant-isolation E2E, privileged MFA, OIDC origin and database checks
are independently verified. Keep source/guardian documents,
admissions, transfers and educational profiles on appropriate
encrypted/retention-controlled stores. Do not serve a dummy login
or bypass consent to make a preview work.

Configure `CABO_ALLOWED_ORIGINS` with only explicit trusted HTTPS
origins, `TRUST_PROXY_HOPS=1` behind the Cloudflare ingress,
and verify sign-in callbacks, sessions and CSRF protections on mobile
and desktop. Never migrate another app's secret into this project.

## Verification
- Three migration-gate unit tests passed independently.
- Wrangler 4.155.0 bundled the candidate Worker with
  `--dry-run --containers-rollout=none`.
- Branch-scoped CircleCI job now runs the gate, builds the original
  React UI and Express API and checks the Cloudflare bundle.
- Full Docker image, real OIDC, children/parents/teachers, providers,
  mobile E2E and database operations have **not** passed yet.
- Render stays untouched until verified Cloudflare production cutover.
- No public application/portal or Cloudflare Container has been deployed.
