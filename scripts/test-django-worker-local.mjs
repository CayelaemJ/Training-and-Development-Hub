/**
 * Exercise the actual Pyodide/workerd Django WSGI runtime with synthetic data.
 * Run after `pywrangler sync` has populated the Python dependencies.
 * Never uses network staging or real learner data. No deployment credentials.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { open, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const cwd = fileURLToPath(new URL("../services/cloudflare-django-worker/", import.meta.url));
const varsFile = path.join(cwd, ".dev.vars");
const host = "cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev";
const token = "synthetic-only-local-worker-token-0123456789";
const started = Date.now();
let child;
let port = 0;
let ownsVarsFile = false;
async function unusedPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const selected = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  assert(selected > 0);
  return selected;
}
async function request(endpoint, options = {}) {
  return fetch(`http://127.0.0.1:${port}${endpoint}`, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    ...options,
    headers: { Host: host, "Content-Type": "application/json", ...(options.headers || {}) },
  });
}
async function untilHealthy() {
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw Error("Worker runtime exited before healthy");
    try {
      const response = await request("/health");
      if (response.status === 200) return;
    } catch {
      // Python/WASM startup may take longer than a normal HTTP request.
    }
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  throw Error("Worker runtime did not return healthy within 150 seconds");
}

try {
  // Exclusive creation; never overwrite an existing developer secrets file.
  const fh = await open(varsFile, "wx", 0o600);
  ownsVarsFile = true;
  try {
    await fh.writeFile(
      `DJANGO_SECRET_KEY=synthetic-only-local-signing-key-0123456789\nDJANGO_WORKER_TOKEN=${token}\n`,
    );
  } finally {
    await fh.close();
  }
  port = await unusedPort();
  child = spawn("uvx", [
    "--from", "workers-py==1.17.9", "pywrangler", "dev", "--local",
    "--port", String(port), "--ip", "127.0.0.1",
    "--show-interactive-dev-session", "false", "--log-level", "error",
  ], { cwd, env: { ...process.env, CI: "1" }, detached: true, stdio: ["ignore", "ignore", "ignore"] });
  await untilHealthy();
  const data = JSON.stringify({ concepts: [
    { code: "fractions", masteryPercent: 45, evidenceCount: 5 },
    { code: "algebra", masteryPercent: 90, evidenceCount: 1 },
  ] });
  const post = (body, bearer = undefined) => request("/v1/insights/draft", {
    method: "POST",
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    body,
  });

  assert.equal((await post(data)).status, 401, "anonymous request accepted");
  assert.equal((await post(data, "invalid-synthetic-token")).status, 401, "invalid bearer accepted");
  const result = await post(data, token);
  assert.equal(result.status, 200, "synthetic advisory request failed");
  const advisory = await result.json();
  assert.deepEqual(advisory.insights.map(x => [x.code, x.state]), [
    ["fractions", "needs_practice"],
    ["algebra", "insufficient_evidence"],
  ]);
  assert.equal(advisory.reviewRequired, true);
  assert.equal(advisory.verifiedAssessment, false);
  assert.equal((await post(JSON.stringify({ concepts: [
    { code: "fractions", masteryPercent: 50, evidenceCount: 4, learnerId: "synthetic" },
  ] }), token)).status, 400, "forbidden personal fields accepted");
  assert.equal((await request("/health", { headers: { Host: "forged.invalid" } })).status, 400, "forged host accepted");
  console.log(`PASS: Django Python Worker local runtime, 6 contract checks, ${Math.round((Date.now()-started)/1000)}s`);
} catch (error) {
  console.error("FAIL: Django Python Worker local smoke:", error?.message ?? "Unknown error");
  // Do not include process logs: runtime logs can contain configuration details.
  process.exitCode = 1;
} finally {
  if (child?.pid) {
    // Kill the entire npm/worker process group, including spawned workerd.
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* already exited */ }
  }
  if (ownsVarsFile) await rm(varsFile, { force: true });
}
