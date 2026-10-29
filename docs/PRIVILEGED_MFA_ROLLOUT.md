# CABO Learning Hub — privileged MFA release gate

**Status:** code implemented on a feature branch; **OFF by default**. No identity provider, login account, password or Render secret is changed.

## Design

- Browser uses existing server-side OIDC authorization-code + PKCE flow. Only validated ID token claims obtained by \`openid-client.authorizationCodeGrant\` can create MFA assurance: \`amr\` must explicitly contain \`mfa\` and \`auth_time\` must be an integer timestamp.
- The trusted assurance is stored **server-side** in the existing PostgreSQL session. It is not accepted from HTTP headers, request bodies, cookies, browser state or user-selected roles. Native/test login sessions do **not** acquire MFA assurance automatically.
- \`CABO_PRIVILEGED_MFA_ENFORCEMENT=true\` enables an API middleware after authentication. Every state-changing API request from a resolved elevated portal role requires MFA in the last **10 minutes**; \`/api/platform/*\` sensitive reads also require it. Admin roles include superadmin, directors, school leadership and administrators. Teachers, assessors, learners and parents still require the existing route-specific authorization checks.
- The middleware reads the session and resolves roles from the database on every checked action, rejecting stale/missing MFA evidence with generic 403 \`mfa_required\`, and rejecting role/session database outages with generic 503.
- Authentication, callback, code exchange and logout endpoints are exempt so the user can recover or reauthenticate. Existing API role and tenant checks are **not removed**. No privileged action should trust the client to decide it is an admin.

## Must complete before enabling the flag

1. Select and test a production OIDC provider. CABO's existing fallback to a Replit issuer is not a confirmed long-term identity architecture. Set a correct issuer/client ID and assess account-linking, migration, session renewal, recovery, kid/guardian sign-in and privacy.
2. Confirm the provider returns a **cryptographically validated** \`amr=["mfa"]\` and true \`auth_time\` on recent step-up. A generic \`acr\`, \`pwd\`, \`otp\` or \`sms\` claim alone is intentionally insufficient. If the provider only reports its assurance in \`acr\`, implement and test a provider-specific assurance mapping, not a permissive fallback.
3. Implement an explicit UI reauthenticate/step-up entry point, and verify fresh auth is not silently satisfied by a pre-existing SSO session. Existing \`/api/login\` uses \`prompt: "login consent"\`, but whether this is a sufficient MFA challenge is provider-specific.
4. Verify lockout/recovery, cross-school/country permissions, session rotation and account revocation, admin membership and native app authentication.
5. Run synthetic role tests across all administrator mutations (school setup, permissions, admissions/guardians, financial decisions), 401/403/503 failures, clock skew, 10-minute expiry, and no side effects when denied.
6. Check request rates and Neon query budget: the opt-in guard performs extra role/session reads for privileged mutations. Test at realistic traffic before enabling broadly.
7. Update dashboards and support playbook for \`mfa_required\`; do not expose token claims or MFA methods in logs.

## Rollback

Disable \`CABO_PRIVILEGED_MFA_ENFORCEMENT\` to restore the existing authorization behavior. This does **not** disable ordinary login, roles, sessions, or rate limiting. Do not roll back while real privileged access is under active attack; instead use the provider's incident and recovery procedures.

Related: issue #126 (OIDC/MFA), #102 (launch readiness).
