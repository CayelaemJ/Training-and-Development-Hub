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
