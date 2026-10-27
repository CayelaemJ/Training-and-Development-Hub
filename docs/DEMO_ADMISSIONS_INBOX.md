# Isolated admissions simulation

The platform administrator can rehearse review and fictional offer/decline decisions for synthetic applicants to the exact fictional institution `CABO DEMO | University of Future Skills`. The panel appears in the superadmin command centre only when its endpoint is enabled and permitted. It never contacts a university and does not provide a real enrolment, payment check, identity check or verified offer.

## Boundaries

The server requires `CABO_ENVIRONMENT=testing`, `CABO_TEST_DATABASE_ISOLATED=true`, `ENABLE_DEMO_ADMISSIONS_INBOX=true`, and the existing explicitly configured test superadmin. Defaults deny access. Railway environment variables alone cannot enable the feature. No flag is enabled by this change.

Only bounded synthetic candidate IDs can be read or changed. Both listing and mutation enforce the fictional institution. References are redacted, raw candidate documents/statements are not returned, and responses are private/no-store. Status changes use a row-locked transaction with an audit event; repeated or conflicting decisions are rejected. Existing application middleware supplies request throttling and cookie-origin controls.

The phase reuses existing admissions tables and introduces no migration. It must only run in an already provisioned isolated database with synthetic fixtures. Do not enable it in a live school/university deployment. Real institutional integrations and child/guardian verification are separate release gates.

## Validation and rollback

`node --test artifacts/api-server/src/tests/demoAdmissionsPolicy.test.mjs` covers feature boundaries and transitions. `node scripts/test-demo-admissions.mjs` runs the real router against disposable PGlite tables and independent injected test identities: unauthenticated and nonadmin denial, disabled/production/nonisolated environments, real-applicant and other-institution exclusion, reference redaction, malformed input, allowed transitions, conflicting decisions and audit entries. Test identity headers exist only inside the harness.

The integration test is included in both CircleCI and GitHub verification. Required CI must pass before merge. Disable `ENABLE_DEMO_ADMISSIONS_INBOX` to withdraw the demo; a code revert needs no schema rollback. Signed receipts, production registration and official offers are not implemented or claimed by this simulation.
