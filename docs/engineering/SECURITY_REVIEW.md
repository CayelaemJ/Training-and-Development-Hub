# Security review — 2026-11-22 session

**Scope of this review:** targeted, not exhaustive. Reviewed the request pipeline (`app.ts`), origin/CSRF and OIDC policies, the native guardian overview, organization membership, and every server path that resolves a user by email. A full route-by-route authorization review and penetration test remain open (backlog P0-06).

## Confirmed already on main (no change needed)

| Control | Evidence |
|---|---|
| Cookie-authenticated mutations must present a trusted `Origin`/`Referer`; header-less requests are allowed only without cookies | `artifacts/api-server/src/lib/originPolicy.ts` `permittedMutationOrigin`, applied in `app.ts` before routing |
| Credentialed CORS only for explicitly configured origins | `trustedOrigins`, `permittedBrowserOrigin` |
| OIDC callback origin from approved host only; return paths reject `//`, backslashes, control chars and encoded separators | `oidcRequestOrigin`, `safeReturnPath` |
| API rate limit before cookie/body parsing | `app.ts`, `middlewares/rateLimit.ts` |
| Guardian learner names require verified relationship, active enrolment **and** latest per-school verification decision; fails closed on truncated evidence | `routes/nativeParent.ts`, `lib/parentMobilePolicy.ts` |
| Error boundary emits no stack, SQL or identifiers | `app.ts` final handler, `lib/httpPrivacy.ts` |
| Session IDs validated before lookup | `lib/sessionIdPolicy.ts` (PR #186) |

## Finding F-2026-11-22-01 — consent-less organization membership and account/name disclosure

**Severity:** High (P0 for a platform serving minors). **Status:** fixed on branch `fix/org-member-consent-invitations-20261122`; not deployed.

**Before the fix** (`routes/organizations.ts` on main `5a30e1c`):

1. `POST /api/organizations` lets any signed-in user create an organization and become its owner.
2. `POST /api/organizations/:orgId/members {email, role}` looked up `users.email` and inserted an `organization_members` row immediately — no invitation, notification or acceptance.
3. The response was `404 "User must sign up…"` for unknown emails and `201 {userId}` for known ones: an account-existence oracle that also returned the internal user id.
4. `GET /api/organizations/:orgId/members` then returned the added person's `email`, `firstName` and `lastName`.

**Impact:** any account holder could confirm whether an email (e.g. a learner's, possibly a child's) is registered, obtain that person's real name and internal id, place them in a group and assign them work — all without their knowledge. The same oracle existed in course-staff assignment (`404` vs `403`) and hierarchy grants (`404` vs `409`), reachable by anyone via a self-created organization.

**Fix:**

- New table `organization_invitations` (additive migration `lib/db/migrations/20261122_organization_invitations.sql`), keyed by normalized email; one open invitation per organization+email; CHECK constraints on role (owner not invitable), status, normalization, expiry (default 14 days) and response timestamps.
- `POST …/members` now creates an invitation and returns the **same `202` body for every email**. It still returns `409` when the email already belongs to a member — managers can already see member emails, so this discloses nothing new. Open invitations per organization are capped at 500.
- Membership is created only in `POST /api/organization-invitations/:id/decision` by the invitee, inside a transaction that locks the invitation row (`SELECT … FOR UPDATE`).
- **Email trust:** `users.email` is copied from identity claims without checking `email_verified` (`routes/auth.ts` `upsertUser`). The invitee is therefore matched only when the stored account email **equals the session's `verified_email`**, which is set only from a validated ID token with `email_verified=true` — the same rule notification consent already uses. Sessions without a verified email (including native sessions today) see no invitations and cannot accept; this fails closed.
- `GET …/invitations` (managers) lists only what managers typed and never joins `users`. `DELETE …/invitations/:id` revokes.
- Course-staff and hierarchy assignment return one response for "no account" and "not a member".

**Verification:** see `TEST_RESULTS.md` — policy unit tests (8), source-contract tests (5, shown to fail 4/5 on the unfixed route), PGlite DDL test (CI), and a 14-check harness on local PostgreSQL 16 including a genuinely concurrent double-accept (exactly one winner).

**Not verified:** TypeScript typecheck, production web build, Playwright checks, and an end-to-end staging run with two synthetic tenants. These must pass in CI and staging before merge.

**Rollout:** apply the migration with the existing runner (`node lib/db/scripts/migrate-learner-support.mjs 20261122_organization_invitations`) on staging, then production, with owner authorization, **before** deploying the API. If the API ships first, inviting fails with 500 — closed, not open.

**Rollback:** redeploy the previous API build. The table can stay (unused) or be dropped with `DROP TABLE IF EXISTS organization_invitations;` if no invitation data must be kept. Rolling back the API restores the vulnerable behaviour, so prefer fixing forward.

**Behaviour change for users:** managers no longer add people instantly; people must accept. Existing memberships are unaffected. Users whose identity provider does not mark their email verified cannot accept until it is verified — confirm the production provider sets `email_verified`.

## Residual risks found but not fixed this session

| ID | Risk | Severity | Backlog |
|---|---|---|---|
| R-01 | `POST /api/guardian-relationships` returns 400 for unknown guardian email — account-existence oracle (no name disclosure; guardian must still accept) | Medium | P2-01 |
| R-02 | `users.email` stored without requiring `email_verified`; any other future email-matching feature must use `verified_email` | Medium | P0-05 |
| R-03 | Authorization is application-layer only; no Postgres RLS | Medium | P2-02 |
| R-04 | Remaining routes not individually reviewed for object-level authorization | Unknown | P0-06 |
| R-05 | Security scan results in CircleCI/Snyk/ZAP not observable from this session | Unknown | P2-05 |
