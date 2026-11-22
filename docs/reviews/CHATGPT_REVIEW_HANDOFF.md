# Independent review handoff — consent-based membership and learner-request gates

**Implementer:** Claude · **Reviewer requested:** ChatGPT · **Owner decision:** pending
**Review status:** NOT YET REVIEWED. Do not treat as approved.

## Responses to Codex review of `06a16ae` (2026-11-22)

| Codex finding | Response | Commit |
|---|---|---|
| P2: invitation inbox unreachable for users without an organization (learner/parent navigation omits `/organizations`) | Agreed. `InvitationInbox` is now also mounted on the role dashboard `/`, which every portal can reach. The page reloads after acceptance so portal and navigation update | `85ee311` |
| P2: expired pending invitation blocks re-inviting while returning 202 | Agreed. The insert is now `ON CONFLICT (organization_id,email) WHERE status='pending' DO UPDATE … WHERE expires_at <= now()`: an expired row is refreshed in place (new role, inviter, 14-day expiry); an unexpired row is unchanged. Managers see expired invitations flagged. PostgreSQL 16 harness 16/16; PGlite test extended | `85ee311` |
| P2: Android version code above Int range silently becomes 1 | Agreed. The default applies only when `caboVersionCode` is absent; unparsable values (e.g. `3000000000`) fail the build. Validated with local Gradle for absent, 7, 3000000000, abc, 0 and 2100000000 | `85ee311` |

Replies could not be posted on the threads from the implementing session (GitHub app lacks PR write permission). Comment `@codex review` to re-review.

## Implementation summary

**What:** organization managers can no longer add a registered account to their organization by email. They create an invitation; the account holder accepts or declines. The invite response is identical for every email. Two smaller account-existence oracles (course-staff and hierarchy assignment) were also removed.

**Why:** on main, any signed-in user could create an organization, add any registered person by email without their knowledge, learn whether that email had an account, and read the person's first name, last name and email. Learners may be minors. Full write-up: `docs/engineering/SECURITY_REVIEW.md` (F-2026-11-22-01).

**Requirements addressed:** directive §5.4 (user approval workflows, tenant boundaries), §13 (server-side authorization), §14 (data minimization, children's data), AGENTS.md hard boundaries (object-level authorization; protect children's data).

## Change inventory

| Item | Value |
|---|---|
| Branch | `fix/org-member-consent-invitations-20261122` |
| Base commit | `5a30e1c9bbcf44d9e2f3d8c17f41b9109316061f` (main, 2026-11-21) |
| Code commits | `602c830` feat(db) · `3b76778` fix(security) · `83fb70e` feat(ui) · `2ed9974` fix(security) learner-request gates · `d1e8ade` build(android) release config · `a8ab4e8` effective scores with assessor overrides · `51ab90f` learner reviewed results · `85ee311` Codex review fixes · `a0ef12e` Windows installer · `4ffa2f8`/`8a4a42b` two-tenant integration suite · `e461525`…`e3ee138` academic records suite · `d3e2e64` attendance privacy fix + school operations suite |
| Docs commit | the commit after `83fb70e` on this branch (audit, backlog, security review, test results, this handoff, execution state) |
| Related PRs | none open for this defect; PR numbers for older security work (#58/#59/#60) are referenced in the backlog only |
| Migration | `lib/db/migrations/20261122_organization_invitations.sql` (additive: one table, two indexes) |
| Config changes | two new opt-in flags, default off: `ENABLE_LEARNER_GUARDIAN_INVITES`, `ENABLE_LEARNER_TRANSFER_REQUESTS` |

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
artifacts/api-server/src/lib/learnerInitiatedRequestPolicy.ts      (new, batch 2)
artifacts/api-server/src/routes/institutionRecords.ts              (batch 2: gates + uniform 202)
artifacts/api-server/src/tests/learnerInitiatedRequestPolicy.test.mjs (new, batch 2)
docs/INSTITUTION_TRANSFERS_AND_GUARDIANS.md                        (batch 2: flags documented)
native-apps/android/app/build.gradle.kts                           (batch 3: release build type + signing)
.github/workflows/native-android-release.yml                       (batch 3: new, manual dispatch only)
native-apps/android/TEST_BUILDS.md                                 (batch 3: release candidate guide)
```

API surface:

| Method & path | Who | Behaviour |
|---|---|---|
| `POST /api/organizations/:orgId/members` | owner, admin, superadmin | Creates pending invitation; **202** uniform body; 409 if email already a member; 429 at 500 open invitations; admins cannot invite admins |
| `GET /api/organizations/:orgId/invitations` | owner, admin | Pending invitations: id, typed email, role, dates. No join to `users` |
| `DELETE /api/organizations/:orgId/invitations/:id` | owner, admin | Revoke pending → 204, else 404 |
| `GET /api/organization-invitations` | any signed-in | Pending, unexpired invitations for the session's **verified** email; org name and role only |
| `POST /api/organization-invitations/:id/decision` `{decision}` | addressee | Row-locked; accept inserts membership with invitation role; uniform 404 for missing/answered/expired/not-yours |
| `POST /api/guardian-relationships` | learner | **404 unless `ENABLE_LEARNER_GUARDIAN_INVITES=true`**; when on, 202 with one body for every email (was 400/201/409) |
| `POST /api/institution-records/transfers` | learner | **404 unless `ENABLE_LEARNER_TRANSFER_REQUESTS=true`**; otherwise unchanged |
| `GET /api/organizations/:orgId/submissions`, `…/dashboard` | owner, admin | Adds effective marks (latest assessor override per question, else AI), `reviewStatus`, `averageEffectiveScore`, `assessorAdjustedSubmissions`; AI fields unchanged |
| `GET /api/my-assignment-results` | signed-in learner | Own submissions only (latest 100): AI and effective scores, reviewed questions with review reason; no assessor identity, no stored answers |

## Verification evidence

See `docs/engineering/TEST_RESULTS.md` for exact commands and output summaries.

- New policy + contract tests: 13/13 pass; contract tests fail 4/5 against main's unfixed route (negative control).
- Local PostgreSQL 16.15: 14/14 migration and transaction checks pass, including a real concurrent double-accept.
- Learner-request gates: 4/4 pass; 2/4 fail against main's unfixed route.
- Full built-in suite: 246/251 pass; 5 failures are missing packages only (no assertion failures).
- Static route inventory of all 201 handlers: no further high-severity defect found (`SECURITY_REVIEW.md`, pass 2).
- Runtime two-tenant integration suite for the organizations router: 15/15 in CI. Full `build` job green at `8a4a42b` (typecheck, build, browser checks).
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
11. Batch 2: is returning 404 for the gated learner routes the right failure mode, and does gating them conflict with any staged country-pilot workflow you can see?
12. Does the pass-2 route inventory method miss a class of authorization defect you would check for?
13. Batch 3 (Android): is the secret handling in `native-android-release.yml` sound (keystore in `RUNNER_TEMP`, values via `GITHUB_ENV`, removal on `always()`)? Does overriding `ENABLE_TEST_LOGIN`/`ENABLE_DEMO_MODE` in the `release` build type reliably beat `defaultConfig` fields in AGP 8.9? This batch is **unverified** until the PR's Android debug job and one manual release run pass.
14. Attendance fix (F-03): is projecting `id, organizationId, day, status` enough, or should the legacy all-schools endpoint be retired in favour of the scoped one?
15. Design issue D-2026-11-22-01: per-school guardian status vs deriving status from per-school events — which do you recommend?
