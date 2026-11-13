/**
 * Exercise the actual Pyodide/workerd Django WSGI runtime with synthetic data.
 * Run after `pywrangler sync` has populated the Python dependencies.
 * Never uses network staging or real learner data. No deployment credentials.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { open, rm } from "node:fs/promises";
import { createServer, connect as connectTcp } from "node:net";
import { request as httpRequest } from "node:http";
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
let spawnFailure = null;
let listenerSeen = false;
let lastHttpStatus = null;
let lastErrorName = null;
async function unusedPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const selected = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  assert(selected > 0);
  return selected;
}
async function request(endpoint, options = {}) {
  // Node fetch (Undici) can replace/normalise Host, which makes Django
  // correctly reject a local workerd request as an untrusted host.
  // Node's HTTP client preserves the explicit Host header byte-for-byte.
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: "127.0.0.1",
      port,
      path: endpoint,
      method: options.method ?? "GET",
      headers: { Host: host, "Content-Type": "application/json", ...(options.headers ?? {}) },
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("error", reject);
      response.on("end", () => {
        const payload = Buffer.concat(chunks).toString("utf8");
        resolve({ status: response.statusCode, json: async () => JSON.parse(payload) });
      });
    });
    req.on("error", reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}
async function portAcceptsConnections() {
  return new Promise(resolve => {
    const socket = connectTcp({host: "127.0.0.1", port});
    const done = result => { socket.destroy(); resolve(result); };
    socket.setTimeout(1200);
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}

async function untilHealthy() {
  const deadline = Date.now() + 360_000;
  while (Date.now() < deadline) {
    if (spawnFailure) throw Error("Worker runtime failed to launch");
    if (child.exitCode !== null || child.signalCode !== null) throw Error("Worker runtime exited before healthy");
    if (!listenerSeen) {
      listenerSeen = await portAcceptsConnections();
      if (listenerSeen) {
        console.log(`Local workerd TCP listener ready after ${Math.round((Date.now()-started)/1000)}s`);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1200));
        continue;
      }
    }
    try {
      // Allow the first Python/WASM import to finish. Normal API requests
      // keep their independent 10-second timeout.
      const remaining = Math.max(1_000, deadline - Date.now());
      const response = await request("/health", {timeoutMs: Math.min(180_000, remaining)});
      lastHttpStatus = response.status;
      if (response.status === 200) return;
    } catch (error) {
      // Only record the error class. Never log request bodies or secrets.
      lastErrorName = error?.name ?? "Error";
    }
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  throw Error(`Worker startup timeout (360s): listener=${listenerSeen}, lastHttpStatus=${lastHttpStatus ?? "none"}, lastErrorType=${lastErrorName ?? "none"}`);
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
  console.log("Starting synthetic local Python Worker runtime...");
  // CI can pass an absolute, pinned Wrangler CLI path after Pywrangler sync.
  // This avoids differences in wrapper-based npm/npx launchers on build hosts.
  const cli = process.env.CABO_DJANGO_LOCAL_WRANGLER_CLI;
  if (cli && !path.isAbsolute(cli)) throw Error("Worker test CLI must use an absolute path");
  const argumentsForDev = [
    "dev", "--local", "--port", String(port), "--ip", "127.0.0.1",
    "--show-interactive-dev-session", "false", "--log-level", "error",
  ];
  const command = cli ? process.execPath : "uvx";
  const args = cli
    ? [cli, ...argumentsForDev]
    : ["--from", "workers-py==1.17.9", "pywrangler", ...argumentsForDev];
  // Pass a minimal local-tool environment. Inherited database and cloud
  // credentials must never reach this disposable Worker process.
  const cleanEnv = { CI: "1", WRANGLER_SEND_METRICS: "false", NO_COLOR: "1" };
  for (const name of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "XDG_CACHE_HOME", "UV_CACHE_DIR", "NPM_CONFIG_CACHE"]) {
    if (process.env[name]) cleanEnv[name] = process.env[name];
  }
  child = spawn(command, args, {
    cwd,
    env: cleanEnv,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
  child.on("error", error => { spawnFailure = error; });
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
