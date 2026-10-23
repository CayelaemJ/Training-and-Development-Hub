# CABO superadmin test account (isolated environment only)

The requested username is `cabo_test`. Its password is **never stored in source code, deployment YAML, native apps, or this document**.

This is a disposable dummy-data pilot account, not a production administrator. The existing server expects an scrypt salt-and-hash in `CABO_TEST_PASSWORD_HASH`, a username in `CABO_TEST_LOGIN_USERNAME`, and `ENABLE_CABO_TEST_LOGIN=true`. It accepts such passwords **only** when `CABO_ENVIRONMENT=testing` (or legacy `RAILWAY_ENVIRONMENT_NAME=testing`).

Run `CABO_TEST_SETUP_PASSWORD=<your password> node scripts/configure-cabo-test-login.mjs` locally, using a private secure shell and avoiding shell history where possible. Copy the resulting hash settings into a **separate** Render test service containing **only dummy learners**, with a separate test database. Do not copy the password itself to a repository. Do not put any of these server-side settings in `VITE_*`, APKs, Xcode or Windows clients.

The server-side superadmin gate additionally requires `ENABLE_CABO_SUPERADMIN=true` and `CABO_SUPERADMIN_USER_ID=cabo-isolated-test-learner`. It is deliberately limited to the `testing` environment. A real user or learner should never share these privileges. Verify the seeded user is dummy-only before enabling.

**Important:** The existing browser-facing test login is `POST /api/test-login`; this is separate from the OIDC-based native authentication bridge and does not establish a native bearer token on its own. Do not claim native phone sign-in works merely because the test account can access the browser. Validate cookie/session, PKCE browser return, permissions, device redirect, and logout on an isolated build.

**Do not activate these variables on the currently public CABO pilot or a production school database until isolation is confirmed.**

## Native Android/iPhone tester sign-in

This branch contains a second, separately gated native login endpoint: `POST /api/native/test-login`. It issues a one-hour, server-revocable native bearer session after verifying the same salted scrypt hash used by the web pilot. **It is disabled unless all of the following are true:** `CABO_ENVIRONMENT=testing`, `CABO_TEST_DATABASE_ISOLATED=true`, `ENABLE_CABO_TEST_LOGIN=true`, `ENABLE_CABO_NATIVE_TEST_LOGIN=true` and `CABO_TEST_LOGIN_USERNAME=cabo_test`. The database-isolation flag is a human-confirmed declaration, not a substitute for inspecting the database connection and verifying it does not contain school records.

**iPhone:** `native-apps/ios/Info.plist` has `CABO_ENABLE_TEST_LOGIN=false` by default. Only for a disposable test build, change it to true and set `CABO_API_ORIGIN` to the separate HTTPS test service, then compile/sign that test app. Never publish a build with test login enabled.

**Android:** default builds disable test login. For a disposable pilot build, use `-PcaboApiOrigin=https://<isolated-test-host> -PcaboEnableTestLogin=true`. The Gradle script rejects insecure origins and prevents test-login activation against the normal public pilot URL. Never distribute this build publicly.

Test accounts are **not enabled** on the existing public Render pilot. The user-supplied password remains secret, should be rotated before any wider demonstration and is never committed to GitHub. Native logout revokes these one-hour test bearer sessions even with the normal OIDC bridge disabled. Real parents, learners and teachers must authenticate using the approved identity system; a demo superadmin login is not a substitute.

## Isolated Neon project prepared on 23 October 2026

A **new** Neon project, `cabo-learning-native-demo-isolated` (`lively-dream-83982597`), was provisioned in Frankfurt. Its default database `neondb` was verified to contain **zero public tables** at preparation time. It is not the existing `cabo-learning-hub` project. No real school records were copied.

A separate, **disabled** free-plan Render preview service now exists: `cabo-learning-native-isolated-preview` (`srv-dbdkf86q1p3s738u67e0`). Its service URL is https://cabo-learning-native-isolated-preview.onrender.com and dashboard is https://dashboard.render.com/web/srv-dbdkf86q1p3s738u67e0. The new Neon database credentials could not be passed automatically to Render. **The preview's initial deployment failed closed by design**, because `DATABASE_URL` and isolation/startup flags have not been enabled; it is not a usable login endpoint yet. The requested demo password has been stored on that preview as a **salted scrypt hash only**. Neither native login nor superadmin elevation is enabled. The public CABO Learning Hub service remains separate and unchanged.

The dedicated Render service already uses the `feat/real-native-cabo-apps` branch, `bash scripts/render-build.sh` build command, and `bash scripts/render-native-test-start.sh` startup guard with auto-deploy disabled. Retrieve the isolated Neon project's `DATABASE_URL` directly from https://console.neon.tech/ into that Render service's private environment variable editor. Do not paste connection credentials into GitHub or chat. Configure `CABO_ENVIRONMENT=testing`, `CABO_TEST_DATABASE_ISOLATED=true`, `CABO_NATIVE_TEST_BOOTSTRAP=true`, `CABO_TEST_DATABASE_MARKER=native-demo-lively-dream-83982597`, `ENABLE_CABO_TEST_LOGIN=true`, `ENABLE_CABO_NATIVE_TEST_LOGIN=true`, `CABO_TEST_LOGIN_USERNAME=cabo_test`, `ENABLE_CABO_SUPERADMIN=true`, `CABO_SUPERADMIN_USER_ID=cabo-isolated-test-learner`, `ENABLE_CABO_DEMO_SEED=true`, and `CABO_QUIZ_IDEMPOTENCY_ENABLED=true`. Generate `CABO_TEST_PASSWORD_HASH` with the supplied local helper and enter **only the salted verifier**, never the plaintext password.

The startup script checks that the configured Neon public schema is completely empty before a one-time Drizzle push. It applies reviewed additive migrations and writes an exact test-deployment marker; restarts refuse any nonempty unmarked or mismatched database. This deployment process **has not yet been executed on Render**, so compilation and database migration compatibility still need live validation.

Once ready, run `scripts/smoke-native-test-login.mjs` with private `CABO_TEST_BASE_URL` and `CABO_TEST_PASSWORD` environment variables. The script verifies a real native bearer token, the superadmin role, only `[DEMO]` institutions, token revocation and post-logout rejection without printing credentials or learner records. A passing smoke test is still not a substitute for physical-device sign-in and tenant-isolation penetration testing.

## Windows isolated demo variant

Windows WinUI 3 now has a compile-time opt-in for the same `cabo_test` account. The normal MSBuild output and all store builds hide the test UI. For a disposable **debug** build only, use `-p:CaboIsolatedTestBuild=true` and set `CABO_ISOLATED_TEST_ORIGIN` to the exact separate HTTPS Render preview origin at runtime. The client rejects the public CABO pilot origin for password test mode and saves only the server-issued bearer token encrypted with Windows DPAPI. A second Windows GitHub Actions compile now validates this opt-in code path without exposing credentials.

The Windows app remains untested on actual hardware. Do not distribute debug builds with the test-login symbol to schools, learners or the public.
