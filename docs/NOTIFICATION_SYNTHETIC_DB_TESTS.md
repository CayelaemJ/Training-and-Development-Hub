# CABO notification migrations — reproducible zero-cloud smoke

The additive notification migrations should **not** be applied to CABO's live Neon database until school/guardian consent and operations reviewers approve them. This branch adds a fast, fully local PostgreSQL-compatible test using **PGlite**, a development dependency already pinned in the API server package.

Run without a container, network, secret or cloud account:

\`\`\`bash
pnpm install --frozen-lockfile
node --test artifacts/api-server/src/tests/notificationSyntheticDatabase.test.mjs
\`\`\`

The test automatically runs with the repository's existing \`node --test artifacts/api-server/src/tests/*.test.mjs\` workflow. It creates minimal users and organizations with fictional IDs in a disposable **in-memory** PostgreSQL engine, applies the exact three review-only notification migrations, and verifies:

- Missing opt-in defaults to denied and a consent grant without confirmation is rejected by the database.
- Invalid school IDs/event kinds and duplicate preference/event keys fail.
- Synthetic records for two different schools/guardians are distinguishable under account+school filtering. **This is not proof of row-level security**: it only checks the query's explicit filters.
- A revoked preference and append-only audit event can commit in one transaction, with no real email addresses or child records stored.
- Outbox event provenance cannot reference a nonexistent event; invalid provenance kinds, attempt overflows and unsupported delivery states fail.
- A rolled-back outbox transaction leaves no event or source, and deleting an outbox event cascades the source.
- No network, mail provider, browser or worker is invoked.

**Still required before activating notifications:** full two-school, two-guardian API acceptance tests using the application authentication/permission middleware; concurrent **real PostgreSQL** workers proving \`SKIP LOCKED\` leasing; identity-provider MFA and \`email_verified\` acceptance; school/guardian legal consent UI; matching the records against provider-approved delivery receipts and testing retention/deletion. PGlite does not establish these guarantees.

Never put real DOBs, ID numbers, learners, parents, email lists, tokens or database URLs in synthetic fixtures.

Related PRs: #146/#147 (preference UI), #139/#140 (outbox) and #142/#143 (school consent policy). Issue #127 remains open until delivery is verified end-to-end.
