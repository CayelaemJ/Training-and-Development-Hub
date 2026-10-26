# CABO isolated native test setup — Render and Neon

**Status as of 26 October 2026.** This runbook describes the dedicated test preview only. The public CABO pilot and production school systems are separate and were not changed by this setup. School-specific latest-decision authorization is deployed on the preview at commit `fdf5911e257bc1ca170597f14c86a346bff81601`.

## Isolated service and database

- Render service: `cabo-learning-native-isolated-preview` (`srv-dbdkf86q1p3s738u67e0`)
- Preview URL: https://cabo-learning-native-isolated-preview.onrender.com
- Source branch: `feat/real-native-cabo-apps`; auto-deploy is disabled.
- Database: dedicated Neon project `cabo-learning-native-demo-isolated`, branch `br-still-mountain-b9592t38`, database `neondb`.
- The startup guard verified the expected deployment marker, skipped further schema pushes, and reported four synthetic organisations, 13 fixture identities, four courses, four assessments and two native learner quizzes. Aggregate checks found four `[DEMO]` organisations and no non-demo organisations.

The Neon connection string is stored only in Render's private `DATABASE_URL` setting. Never add it to this document, GitHub, client builds or logs. The database started empty; the guarded initial schema setup and additive migrations ran only on this isolated project.

## Test-only identity gates

`POST /api/native/test-login` is available only when all of these server-side values are enabled:

- `CABO_ENVIRONMENT=testing`
- `CABO_TEST_DATABASE_ISOLATED=true`
- `ENABLE_CABO_TEST_LOGIN=true`
- `ENABLE_CABO_NATIVE_TEST_LOGIN=true`
- `CABO_TEST_LOGIN_USERNAME=cabo_test`

The `cabo_test` superadmin elevation additionally requires `ENABLE_CABO_SUPERADMIN=true` and `CABO_SUPERADMIN_USER_ID=cabo-isolated-test-learner`. Its password exists only as a salted scrypt verifier in Render. Do not store the plaintext password in source control or a client app.

PR #71 added support for separately configured synthetic role principals through `CABO_TEST_USERS_JSON`. The Render preview has `cabo_parent_south`, mapped to the fictional `cabo-fixture-parent-south` identity and `@example.invalid` address. Its hash is also stored server-side only. This parent identity is separate from the superadmin identity.

## Verification recorded

- Render health check: `/api/healthz` returned 200.
- Native superadmin smoke: bearer issuance, superadmin role, demo-only organisation registry, logout and post-logout rejection passed.
- Synthetic parent smoke: sign-in passed; its accepted-but-unverified guardian relationship returned no learner name or learner ID; logout revoked the token. Repeat it with `scripts/smoke-native-parent-fixture.mjs`, using `CABO_TEST_BASE_URL` and `CABO_TEST_PARENT_PASSWORD` from a private runner.
- Anonymous requests to the parent overview, guardian report, issued-report and report-integrity endpoints returned 401 after the latest deploy.
- Regression cases for school approval, unrelated school, missing or revoked decisions, pending guardians and missing enrollment passed in CI; typecheck, build, CircleCI, Snyk and browser/mobile release checks also passed.

The existing live parent fixture remains accepted but unverified. An authenticated Render exercise that grants access after a school approval and denies it after revocation is still required; policy unit tests do not replace that end-to-end check.

## Safe operations

The Render start command is `bash scripts/render-native-test-start.sh`. The guard checks the isolated database marker on restart and refuses unmarked or mismatched non-empty databases. Environment-variable updates trigger a new Render deployment; do not trigger an additional deploy while one is already queued or running.

Keep `ENABLE_CABO_DEMO_SEED=true`, native test login and superadmin elevation on this isolated preview only. The public CABO pilot remains separate. Real parents, learners and teachers must use the approved identity system; a demo superadmin or test parent is not a production identity.

## Still unverified

- Physical Android, iPhone/iPad and Windows device sign-in, accessibility, secure storage and low-end-device performance.
- Production OIDC/PKCE callbacks and store-signed release builds.
- Authenticated Render verification and revocation through parent and school administrator sessions; CI covers missing-review, cross-school and unenrolled denial cases.
- Independent penetration testing, POPIA/DPIA and school governance sign-off, restore rehearsal, monitoring/alerting and production cutover.
