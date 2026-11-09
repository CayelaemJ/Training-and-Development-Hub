import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { build } = require("esbuild");
const dir = await mkdtemp(path.join(tmpdir(), "cabo-r2-staging-"));
after(async () => rm(dir, { recursive: true, force: true }));
const outfile = path.join(dir, "r2-staging.mjs");
await build({
  entryPoints: [fileURLToPath(new URL("../lib/r2Staging.ts", import.meta.url))],
  platform: "node", format: "esm", bundle: true, outfile, logLevel: "silent",
});
const {
  r2Configured, r2Config, newStagingKey, validateStagingKey,
  putR2StagingObject, getR2StagingObject, headR2StagingObject, deleteR2StagingObject,
} = await import(pathToFileURL(outfile).href);

const environment = {
  CABO_R2_STORAGE_ENABLED: "true",
  CABO_R2_PRIVACY_REVIEW_APPROVED: "true",
  CABO_R2_QUOTA_ENFORCEMENT_READY: "true",
  CABO_R2_ACCOUNT_ID: "a".repeat(32),
  CABO_R2_ACCESS_KEY_ID: "testAccessKey",
  CABO_R2_SECRET_ACCESS_KEY: "local-test-secret-do-not-deploy",
  CABO_R2_BUCKET: "cabo-learning-staging-private",
};

test("R2 remains disabled unless privacy, credentials and enforceable quotas are approved", () => {
  assert.equal(r2Configured({}), false);
  for (const name of [
    "CABO_R2_STORAGE_ENABLED", "CABO_R2_PRIVACY_REVIEW_APPROVED",
    "CABO_R2_QUOTA_ENFORCEMENT_READY", "CABO_R2_ACCOUNT_ID",
    "CABO_R2_ACCESS_KEY_ID", "CABO_R2_SECRET_ACCESS_KEY", "CABO_R2_BUCKET",
  ]) {
    const env = { ...environment };
    delete env[name];
    assert.equal(r2Configured(env), false, name);
  }
  assert.equal(r2Configured(environment), true);
  assert.throws(() => r2Config({ ...environment, CABO_R2_ACCOUNT_ID: "bad" }), /Invalid R2/);
  assert.throws(() => r2Config({ ...environment, CABO_R2_BUCKET: "someone-elses-bucket" }), /not approved/);
});
test("only opaque UUID keys in approved prefixes are allowed", () => {
  for (const stage of ["quarantine", "approved", "temporary-exports"]) {
    const key = newStagingKey(stage);
    assert.match(key, new RegExp("^" + stage + "/[0-9a-f-]{36}$"));
    assert.doesNotThrow(() => validateStagingKey(key));
  }
  for (const key of [
    "../secrets", "quarantine/../x", "school/name", "quarantine/john-smith.pdf",
    "approved/123", "quarantine/00000000-0000-0000-0000-000000000000",
    "quarantine/550e8400-e29b-41d4-a716-446655440000/extra",
  ]) assert.throws(() => validateStagingKey(key), /Invalid CABO staging object key/);
});
test("network operations fail closed and sign only private R2 endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const previous = Object.fromEntries(Object.keys(environment).map(k => [k, process.env[k]]));
  const calls = [];
  try {
    Object.assign(process.env, environment);
    const key = newStagingKey("quarantine");
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      if (init.method === "GET") return new Response(Buffer.from("abc"), { status: 200, headers: { "content-length": "3" } });
      if (init.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": "3" } });
      return new Response(null, { status: 204 });
    };
    await assert.rejects(putR2StagingObject(key, Buffer.alloc(0)), /between 1 byte/);
    await assert.rejects(putR2StagingObject(key, Buffer.alloc(8 * 1024 * 1024 + 1)), /8 MiB/);
    assert.equal(calls.length, 0);
    await putR2StagingObject(key, Buffer.from("abc"));
    assert.equal((await getR2StagingObject(key)).toString(), "abc");
    assert.equal(await headR2StagingObject(key), 3);
    await deleteR2StagingObject(key);
    assert.equal(calls.length, 4);
    assert.deepEqual(calls.map(x => x.init.method), ["PUT", "GET", "HEAD", "DELETE"]);
    for (const call of calls) {
      assert.match(call.url, /^https:\/\/a{32}\.r2\.cloudflarestorage\.com\/cabo-learning-staging-private\//);
      assert.match(call.init.headers.Authorization, /^AWS4-HMAC-SHA256 /);
      assert.ok(call.init.signal);
      assert.equal(call.init.redirect, "error");
    }
    globalThis.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(getR2StagingObject(key), /failed \(503\)/);
    globalThis.fetch = async () => new Response(Buffer.from("abc"), { status: 200 });
    await assert.rejects(getR2StagingObject(key), /Invalid R2 response size/);
    process.env.CABO_R2_STORAGE_ENABLED = "false";
    await assert.rejects(getR2StagingObject(key), /not approved/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
