# Session credential handling

The API creates session IDs from 32 cryptographically random bytes and stores sessions server-side. Browser clients send the ID in the `sid` HttpOnly, Secure, SameSite=Lax cookie; native clients send the same ID as an Authorization Bearer credential. The server accepts only the generated 64-character lowercase hexadecimal representation before querying the session table.

Malformed Bearer credentials are rejected without falling back to a cookie, preventing ambiguous authentication when callers supply both credential forms. Non-Bearer authorization schemes do not override a valid browser session cookie. This validation does not replace session expiry, revocation, role checks, or object/tenant authorization.

Regression coverage: `node --test artifacts/api-server/src/tests/sessionIdPolicy.test.mjs`.
