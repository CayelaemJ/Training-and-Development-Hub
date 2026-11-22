# Independent review handoff — consent-based organization membership

**Implementer:** Claude · **Reviewer requested:** ChatGPT · **Owner decision:** pending
**Review status:** NOT YET REVIEWED. Do not treat as approved.

## Implementation summary

**What:** organization managers can no longer add a registered account to their organization by email. They create an invitation; the account holder accepts or declines. The invite response is identical for every email. Two smaller account-existence oracles (course-staff and hierarchy assignment) were also removed.

**Why:** on main, any signed-in user could create an organization, add any registered person by email without their knowledge, learn whether that email had an account, and read the person's first name, last name and email. Learners may be minors. Full write-up: `docs/engineering/SECURITY_REVIEW.md` (F-2026-11-22-01).

**Requirements addressed:** directive §5.4 (user approval workflows, tenant boundaries), §13 (server-side authorization), §14 (data minimization, children's data), AGENTS.md hard boundaries (object-level authorization; protect children's data).

## Change inventory

| Item | Value |
|---|---|
| Branch | `fix/org-member-consent-invitations-20261122` |
| Base commit | `5a30e1c9bbcf44d9e2f3d8c17f41b9109316061f` (main, 2026-11-21) |
| Code commits | `602c830` feat(db) · `3b76778` fix(security) · `83fb70e` feat(ui) |
| Docs commit | the commit after `83fb70e` on this branch (audit, backlog, security review, test results, this handoff, execution state) |
| Related PRs | none open for this defect; PR numbers for older security work (#58/#59/#60) are referenced in the backlog only |
| Migration | `lib/db/migrations/20261122_organization_invitations.sql` (additive: one table, two indexes) |
| Config changes | none; no new environment variables or feature flags |

Modified files (code):

```
lib/db/migrations/20261122_organization_invitations.sql          (new)
lib/db/src/schema/organizations.ts                                 (+ organizationInvitationsTable)
artifacts/api-server/src/lib/organizationInvitationPolicy.ts       (new, pure functions)
artifacts/api-server/src/routes/organizations.ts                   (invite, list, revoke, inbox, decision)
artifacts/api-server/src/routes/academic.ts                        (uniform course-staff response)
artifacts/api-server/src/routes/managementHierarchy.ts             (uniform grant response)
artifacts/training-platform/src/components/organization-invitations.tsx (new)
artifacts/training-platform/src/pages/organizations.tsx            (wire inbox + pending list)
artifacts/api-server/src/tests/organizationInvitationPolicy.test.mjs   (new)
artifacts/api-server/src/tests/organizationInvitationContract.test.mjs (new)
artifacts/api-server/src/tests/organizationInvitationDatabase.test.mjs (new, PGlite, runs in CI)
scripts/qa/verify-organization-invitations-postgres.sh             (new, local-only harness)
```

API surface:

| Method & path | Who | Behaviour |
|---|---|---|
| `POST /api/organizations/:orgId/members` | owner, admin, superadmin | Creates pending invitation; **202** uniform body; 409 if email already a member; 429 at 500 open invitations; admins cannot invite admins |
| `GET /api/organizations/:orgId/invitations` | owner, admin | Pending invitations: id, typed email, role, dates. No join to `users` |
| `DELETE /api/organizations/:orgId/invitations/:id` | owner, admin | Revoke pending → 204, else 404 |
| `GET /api/organization-invitations` | any signed-in | Pending, unexpired invitations for the session's **verified** email; org name and role only |
| `POST /api/organization-invitations/:id/decision` `{decision}` | addressee | Row-locked; accept inserts membership with invitation role; uniform 404 for missing/answered/expired/not-yours |

## Verification evidence

See `docs/engineering/TEST_RESULTS.md` for exact commands and output summaries.

- New policy + contract tests: 13/13 pass; contract tests fail 4/5 against main's unfixed route (negative control).
- Local PostgreSQL 16.15: 14/14 migration and transaction checks pass, including a real concurrent double-accept.
- Full built-in suite: 242/247 pass; 5 failures are missing packages only (no assertion failures).
- Secret scan: 0 issues.
- **Not run:** typecheck, production build, Playwright, PGlite test, staging E2E. CI must run these.

## Risk assessment

- **Security:** closes an account-existence oracle and consent bypass. New trust dependency: acceptance requires `session.verified_email`; verify that the production identity provider sets `email_verified=true`.
- **Compatibility:** behaviour change — adding a member is no longer instant. Existing memberships unchanged. Any client or script that expects `201 {userId}` from `POST …/members` will break; none found in `artifacts/training-platform`, `native-apps` or `scripts` (only the web page used it, and it is updated).
- **Known limitation:** native sessions and the isolated-test password login do not set `verified_email`, so those sessions see no invitations and cannot accept. Synthetic staging tests of acceptance need an OIDC login with a verified email, or an owner decision to mark verified email on the isolated test login.
- **Data migration:** additive; no data rewritten. Must be applied before the API is deployed (otherwise invites fail closed with 500).
- **Infrastructure:** none.
- **Rollback:** redeploy previous API; optionally drop the table. Rollback re-opens the vulnerability.

## Questions for independent review

1. Is the implementation technically correct (Drizzle usage, transaction and `FOR UPDATE` semantics, partial unique index)?
2. Does it meet the intended requirement that nobody becomes a member without their own consent?
3. Are there security vulnerabilities — in particular, is matching on `users.email` **and** `session.verified_email` sufficient, and is anything still leaked by the 409 "already a member" response?
4. Is tenant isolation correctly enforced for list/revoke (scoped by `organization_id`) and decision (scoped by addressee)?
5. Could any change cause data loss? (Intended: no; migration is additive.)
6. Are error handling and failure modes adequate (migration not yet applied, expired invitation, concurrent accept)?
7. Is the implementation maintainable and consistent with the repository style?
8. Are the tests meaningful and sufficient? What route-level integration test would you require before merge?
9. Any performance concerns (pending-count query per invite, inbox query by email index)?
10. Is the change safe to integrate ahead of the other open PRs listed in `MASTER_COMPLETION_BACKLOG.md`?
