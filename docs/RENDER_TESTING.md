# Render isolated testing (CABO Learning Hub)

## Current test environment

The native application preview is a dedicated Render web service backed by a separate Neon project. It contains synthetic records only; it is not the public pilot or a production school database.

- Render service: `cabo-learning-native-isolated-preview` (`srv-dbdkf86q1p3s738u67e0`)
- URL: https://cabo-learning-native-isolated-preview.onrender.com
- Region: Frankfurt; source branch: `feat/real-native-cabo-apps`; auto-deploy: off
- Build command: `bash scripts/render-build.sh`
- Start command: `bash scripts/render-native-test-start.sh`
- Neon project: `cabo-learning-native-demo-isolated`; database: `neondb`; marker: `cabo-native-test-20261026-7c4f91d2`

Keep the Neon connection string in Render's private `DATABASE_URL` setting. Do not copy credentials into GitHub, client builds, screenshots or logs. The startup guard refuses to push schema into an unmarked non-empty database and verifies the marker on restarts.

## Test account and demo data gates

The server-side test login requires `CABO_ENVIRONMENT=testing`, `CABO_TEST_DATABASE_ISOLATED=true`, `ENABLE_CABO_TEST_LOGIN=true`, `ENABLE_CABO_NATIVE_TEST_LOGIN=true` and `CABO_TEST_LOGIN_USERNAME=cabo_test`. Superadmin elevation additionally requires `ENABLE_CABO_SUPERADMIN=true` and `CABO_SUPERADMIN_USER_ID=cabo-isolated-test-learner`.

Native test login accepts the pinned `cabo_test` superadmin and validated fictional principals from `CABO_TEST_USERS_JSON`. Each principal must use a `cabo-fixture-*` ID, an `@example.invalid` address and a separate salted scrypt hash. The Render preview has the synthetic `cabo_parent_south` principal for parent API checks. Passwords and hashes are never committed.

The four `[DEMO]` organisations, 13 initial role fixtures, four courses, four assessments and two learner quizzes were created on the separate Neon database. Do not enable the seed or test-login flags on the public pilot or a school database.

## Verified on 26 October 2026

- `/api/healthz` returned 200.
- Superadmin smoke verified native bearer login, demo-only registry, logout and token revocation.
- Parent smoke verified the accepted-but-unverified relationship is redacted: no learner name or ID; logout revoked its bearer.
- Anonymous/invalid bearer requests were rejected by protected parent, portal and platform endpoints.
- CI, typecheck, build, CircleCI, Snyk and browser/mobile release checks passed for the synthetic-principal login change.

An accepted relationship is not guardian verification. Authenticated tests for verified active access, school-specific revocation, missing review, cross-school relationships and unenrolled learners remain before release. Physical devices, production OIDC, legal review and independent penetration testing are also still required.
