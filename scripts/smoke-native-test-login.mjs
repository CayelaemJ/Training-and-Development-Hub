#!/usr/bin/env node
// Operator-run smoke test for the ISOLATED CABO native demo service.
// It intentionally never logs credentials, bearer tokens or learner records.
// Required: CABO_TEST_BASE_URL and CABO_TEST_PASSWORD in a private terminal.
const origin = process.env.CABO_TEST_BASE_URL;
const password = process.env.CABO_TEST_PASSWORD;
const expectDemo = process.env.CABO_EXPECT_DEMO_ORGS === "true";

let base;
try {
  base = new URL(origin || "");
  if (base.protocol !== "https:" || base.username || base.password ||
      base.pathname !== "/" || base.search || base.hash ||
      base.hostname === "cabo-learning-hub-pilot.onrender.com") throw Error();
} catch {
  console.error("Configure an isolated HTTPS CABO_TEST_BASE_URL (not the public pilot).");
  process.exit(1);
}
if (typeof password !== "string" || password.length < 12) {
  console.error("Set CABO_TEST_PASSWORD privately; no password is supplied by this script.");
  process.exit(1);
}
const url = (path) => new URL(path, base).toString();
const timeout = AbortSignal.timeout(12000);

let token;
let stage = "sign-in";
try {
  const response = await fetch(url("/api/native/test-login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: "cabo_test", password }),
    redirect: "error", signal: timeout,
  });
  if (response.status !== 200) throw Error("sign-in rejected");
  const body = await response.json();
  if (body.token_type !== "Bearer" || !/^[a-f0-9]{64}$/.test(body.access_token ?? "") ||
      !Number.isSafeInteger(body.expires_in) || body.expires_in > 3600 ||
      body.expires_in < 1) throw Error("invalid native session");
  token = body.access_token;
  const headers = { Authorization: "Bearer " + token, Accept: "application/json" };

  stage = "role verification";
  const portal = await fetch(url("/api/portal/me"), {
    headers, redirect: "error", signal: AbortSignal.timeout(12000),
  });
  if (portal.status !== 200) throw Error("role endpoint unavailable");
  const info = await portal.json();
  if (info.role !== "superadmin") throw Error("test account is not superadmin");

  stage = "dummy organisation verification";
  const listing = await fetch(url("/api/platform/overview"), {
    headers, redirect: "error", signal: AbortSignal.timeout(12000),
  });
  if (listing.status !== 200) throw Error("admin registry access denied");
  const records = (await listing.json()).organizations;
  if (!Array.isArray(records)) throw Error("invalid registry data");
  if (records.some((item) => typeof item.name !== "string" ||
      !item.name.startsWith("[DEMO] "))) throw Error("non-demo institution detected");
  if (expectDemo && records.length < 4) throw Error("demo seed not complete");

  stage = "revoke native token";
  const logout = await fetch(url("/api/native/logout"), {
    method: "POST", headers, redirect: "error", signal: AbortSignal.timeout(12000),
  });
  if (logout.status !== 204) throw Error("token revocation failed");
  const retry = await fetch(url("/api/portal/me"), {
    headers, redirect: "error", signal: AbortSignal.timeout(12000),
  });
  if (retry.status !== 401) throw Error("revoked token still works");

  console.log("PASS: isolated native test login, superadmin role, DEMO registry and token revocation verified.");
} catch {
  // Never print transport errors: proxy or server error bodies can carry secrets.
  console.error("FAIL: isolated native pilot check at stage: " + stage);
  process.exitCode = 1;
} finally {
  token = undefined;
}
