/**
 * Synthetic, no-PII Cloudflare Django Worker staging smoke test.
 * Usage (trusted CI/staging only):
 *   CABO_DJANGO_WORKER_URL=https://cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev \
 *   CABO_DJANGO_WORKER_TOKEN=<staging-secret> node scripts/test-django-worker-staging.mjs
 *
 * Never prints credentials or response payloads containing private data.
 */
import assert from "node:assert/strict";

const expectedHost = "cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev";
const token = process.env.CABO_DJANGO_WORKER_TOKEN;
const baseUrl = process.env.CABO_DJANGO_WORKER_URL;
if (!baseUrl || !token || token.length < 24) {
  console.error("Missing staging Worker URL or strong token; smoke test not run.");
  process.exit(2);
}
const base = new URL(baseUrl);
assert.equal(base.protocol, "https:");
assert.equal(base.hostname, expectedHost);
assert.equal(base.port, "");
assert.equal(base.username, "");
assert.equal(base.password, "");
assert.equal(base.search, "");
assert.equal(base.hash, "");

const healthURL = new URL("/health", base);
const draftURL = new URL("/v1/insights/draft", base);
const options = {
  signal: AbortSignal.timeout(8_000),
  redirect: "error",
  cache: "no-store",
};
const payload = JSON.stringify({
  concepts: [
    { code: "fractions", masteryPercent: 45, evidenceCount: 5 },
    { code: "algebra", masteryPercent: 90, evidenceCount: 1 },
  ],
});
async function request(method, url, authorized, body = undefined) {
  return fetch(url, {
    ...options,
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authorized ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });
}

try {
  const health = await request("GET", healthURL, false);
  assert.equal(health.status, 200, "health endpoint failed");
  assert.equal(health.headers.get("cache-control"), "no-store");

  const anonymous = await request("POST", draftURL, false, payload);
  assert.equal(anonymous.status, 401, "anonymous request was not rejected");

  const withToken = await request("POST", draftURL, true, payload);
  assert.equal(withToken.status, 200, "authorised synthetic request failed");
  assert.equal(withToken.headers.get("cache-control"), "no-store");
  const result = await withToken.json();
  assert.equal(result.reviewRequired, true);
  assert.equal(result.verifiedAssessment, false);
  assert.deepEqual(
    result.insights.map(x => [x.code, x.state]),
    [["fractions", "needs_practice"], ["algebra", "insufficient_evidence"]],
  );

  const identifying = await request("POST", draftURL, true,
    JSON.stringify({ concepts: [{ code: "fractions", masteryPercent: 50, evidenceCount: 5, studentName: "Synthetic" }] }));
  assert.equal(identifying.status, 400, "identifying-field request was not rejected");
  console.log("PASS: Cloudflare Django staging health, auth, advisory results, privacy schema.");
} catch (e) {
  console.error("FAIL: Django staging smoke checks:", e?.name ?? "Error");
  process.exitCode = 1;
}
