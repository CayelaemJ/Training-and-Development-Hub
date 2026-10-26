#!/usr/bin/env node
// Operator-run privacy smoke for a synthetic guardian on the isolated Render preview.
// It never prints credentials, tokens, learner names or learner records.
const origin = process.env.CABO_TEST_BASE_URL;
const password = process.env.CABO_TEST_PARENT_PASSWORD;

let base;
try {
  base = new URL(origin || "");
  if (base.protocol !== "https:" || base.username || base.password ||
      base.pathname !== "/" || base.search || base.hash ||
      base.hostname === "cabo-learning-hub-pilot.onrender.com") throw Error();
} catch {
  console.error("Configure the isolated HTTPS CABO_TEST_BASE_URL (not the public pilot).");
  process.exit(1);
}
if (typeof password !== "string" || password.length < 12) {
  console.error("Set CABO_TEST_PARENT_PASSWORD privately; no password is supplied by this script.");
  process.exit(1);
}
const url = path => new URL(path, base).toString();
const timeout = () => AbortSignal.timeout(12000);
let token;
let stage = "sign-in";
try {
  const login = await fetch(url("/api/native/test-login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: "cabo_parent_south", password }),
    redirect: "error", signal: timeout(),
  });
  if (login.status !== 200) throw Error();
  const session = await login.json();
  if (session.token_type !== "Bearer" || !/^[a-f0-9]{64}$/.test(session.access_token ?? "")) throw Error();
  token = session.access_token;
  const headers = { Authorization: "Bearer " + token, Accept: "application/json" };

  stage = "parent relationship privacy";
  const response = await fetch(url("/api/native/mobile/parent"), {
    headers, redirect: "error", signal: timeout(),
  });
  if (response.status !== 200) throw Error();
  const body = await response.json();
  if (!Array.isArray(body.relationships)) throw Error();
  const accepted = body.relationships.filter(item => item.status === "accepted");
  if (accepted.length < 1 || accepted.some(item =>
      item.verifiedForRead !== false || item.learnerName !== null ||
      Object.hasOwn(item, "learnerId"))) throw Error();

  stage = "logout and revocation";
  const logout = await fetch(url("/api/native/logout"), {
    method: "POST", headers, redirect: "error", signal: timeout(),
  });
  if (logout.status !== 204) throw Error();
  const retry = await fetch(url("/api/native/mobile/parent"), {
    headers, redirect: "error", signal: timeout(),
  });
  if (retry.status !== 401) throw Error();
  console.log("PASS: synthetic parent sign-in, accepted-but-unverified relationship redaction, no learner ID, logout and token revocation.");
} catch {
  // Do not print transport errors: proxy or server bodies can contain sensitive data.
  console.error("FAIL: isolated parent privacy smoke at stage: " + stage);
  process.exitCode = 1;
} finally {
  token = undefined;
}
