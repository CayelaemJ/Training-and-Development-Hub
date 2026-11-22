# Claude execution state

**Last updated:** 2026-11-22 · **Current phase:** 2 (critical stabilization), first P0 fixed on a branch
**Read this first in the next session, then verify every claim against git.**

## Verify-on-resume commands

```sh
git fetch origin && git log --oneline -1 origin/main            # was 5a30e1c9bbcf on 2026-11-22
git log --oneline origin/main..fix/org-member-consent-invitations-20261122
node --test artifacts/api-server/src/tests/organizationInvitation*.test.mjs
```

## Branches

| Branch | Base | Head (code) | State |
|---|---|---|---|
| `fix/org-member-consent-invitations-20261122` | `5a30e1c` | `d1e8ade` (+ docs commits) | Local to the 2026-11-22 session; **not pushed** — this session had read-only access. Delivered as a git bundle and patch series to the owner. |

## Completed

- Repository discovery; baseline tests (229/233 on main, environmental failures only).
- PR inventory via git refs (172 PRs; 71 not provable in main) → `PR_INVENTORY_2026-11-22.md`.
- P0-01 consent-based organization invitations: migration, schema, API, UI, tests (13 + PGlite + 14 Postgres checks).
- Audit, backlog, security review, test results, release readiness, review handoff.
- P0-09 learner guardian-invite and transfer routes gated server-side (`2ed9974`), 4 tests.
- Static authorization review of all 201 route handlers (SECURITY_REVIEW.md pass 2); no further high-severity defect found.
- P1-01 Android release build type, secret-only signing, manual APK/AAB workflow (`d1e8ade`) — **not yet run**.

## In progress / next priority

1. **Owner:** push the branch, open a PR, let CI run typecheck/build/Playwright/PGlite. Fix any CI failure before review.
2. ChatGPT review of the handoff; address findings.
3. P0-08 owner reviews pre-fix memberships (query in SECURITY_REVIEW.md).
4. P0-06 runtime two-tenant authorization integration suite (start with organizations, institutionRecords, academic, learnerSupport, reportCards) — needs an installed workspace.
5. P1-01: confirm the PR's Android debug job passes with the new build script, then run the manual release workflow unsigned; owner adds signing secrets for a signed candidate.
6. P1-02 Windows: release configuration and MSIX packaging on `windows-latest`.

## Blockers

- No GitHub API, push, npm registry, Android SDK, .NET or macOS in the 2026-11-22 environment.
- External/owner: production identity provider and `email_verified`; signing keystore and Windows certificate; legal review; staging DB authorization; chat-zone, safeguarding and scouting policies.

## Decisions requiring owner approval

- Apply migration `20261122_organization_invitations` to staging, then production.
- Whether to keep `ENABLE_LEARNER_GUARDIAN_INVITES` / `ENABLE_LEARNER_TRANSFER_REQUESTS` off (recommended until P2-01 and the transfer gates are done).
- Whether isolated-test and native sessions should carry a verified email (currently they cannot accept invitations).
- PR consolidation list in `MASTER_COMPLETION_BACKLOG.md` (closing PRs needs owner authorization).
- Policies for learner chat, safeguarding escalation and scout access before any implementation.

## Tests executed (2026-11-22)

See `TEST_RESULTS.md`. Last code commit: `d1e8ade` (Android parts unverified); last fully test-verified API commit: `2ed9974`.
