# CABO superadmin test account (isolated environment only)

The requested username is `cabo_test`. Its password is **never stored in source code, deployment YAML, native apps, or this document**.

This is a disposable dummy-data pilot account, not a production administrator. The existing server expects an scrypt salt-and-hash in `CABO_TEST_PASSWORD_HASH`, a username in `CABO_TEST_LOGIN_USERNAME`, and `ENABLE_CABO_TEST_LOGIN=true`. It accepts such passwords **only** when `CABO_ENVIRONMENT=testing` (or legacy `RAILWAY_ENVIRONMENT_NAME=testing`).

Run `CABO_TEST_SETUP_PASSWORD=<your password> node scripts/configure-cabo-test-login.mjs` locally, using a private secure shell and avoiding shell history where possible. Copy the resulting hash settings into a **separate** Render test service containing **only dummy learners**, with a separate test database. Do not copy the password itself to a repository. Do not put any of these server-side settings in `VITE_*`, APKs, Xcode or Windows clients.

The server-side superadmin gate additionally requires `ENABLE_CABO_SUPERADMIN=true` and `CABO_SUPERADMIN_USER_ID=cabo-isolated-test-learner`. It is deliberately limited to the `testing` environment. A real user or learner should never share these privileges. Verify the seeded user is dummy-only before enabling.

**Important:** The existing browser-facing test login is `POST /api/test-login`; this is separate from the OIDC-based native authentication bridge and does not establish a native bearer token on its own. Do not claim native phone sign-in works merely because the test account can access the browser. Validate cookie/session, PKCE browser return, permissions, device redirect, and logout on an isolated build.

**Do not activate these variables on the currently public CABO pilot or a production school database until isolation is confirmed.**
