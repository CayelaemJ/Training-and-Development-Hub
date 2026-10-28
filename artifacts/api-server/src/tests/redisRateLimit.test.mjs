import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { build } = require("esbuild");
const directory = await mkdtemp(path.join(tmpdir(), "cabo-redis-test-"));
const output = path.join(directory, "adapter.mjs");
await build({
  entryPoints: [fileURLToPath(new URL("../lib/redisRateLimit.ts", import.meta.url))],
  platform: "node", bundle: true, format: "esm", outfile: output, logLevel: "silent",
});
const { redisConfigStatus, takeDistributedRateLimit } = await import(pathToFileURL(output).href);
after(async () => rm(directory, { recursive: true, force: true }));

const valid = {
  UPSTASH_REDIS_REST_URL: "https://example-redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "fake-unit-test-token",
  CABO_REDIS_PREFIX: "cabo-test",
};

test("Redis adapter remains optional for a local one-instance demo", () => {
  assert.equal(redisConfigStatus({}), "disabled");
  assert.equal(redisConfigStatus(valid), "enabled");
  assert.equal(redisConfigStatus({ UPSTASH_REDIS_REST_URL: valid.UPSTASH_REDIS_REST_URL }), "invalid");
  assert.equal(redisConfigStatus({ ...valid, UPSTASH_REDIS_REST_URL: "http://localhost:6379" }), "invalid");
  assert.equal(redisConfigStatus({ ...valid, UPSTASH_REDIS_REST_URL: "https://user:pass@x.test" }), "invalid");
});

test("One atomic EVAL evaluates every limit without sending a raw IP", async () => {
  const calls = [];
  const stub = async (url, options) => {
    calls.push({ url, options, command: JSON.parse(options.body) });
    return Response.json({ result: [1, 0] });
  };
  const rules = [["all", 240, 60000], ["authentication", 12, 600000]];
  const result = await takeDistributedRateLimit(rules, "203.0.113.54", stub, valid);
  assert.equal(result.allowed, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command[0], "EVAL");
  assert.equal(calls[0].command[2], 2);
  assert.equal(calls[0].options.headers.Authorization, "Bearer " + valid.UPSTASH_REDIS_REST_TOKEN);
  assert.ok(calls[0].command[3].startsWith("cabo-test:rl:all:"));
  assert.ok(calls[0].command[4].startsWith("cabo-test:rl:authentication:"));
  assert.ok(!calls[0].options.body.includes("203.0.113.54"));
  assert.deepEqual(calls[0].command.slice(-4), [240, 60000, 12, 600000]);
});

test("429 decisions return a useful Retry-After", async () => {
  const stub = async () => Response.json({ result: [0, 61] });
  assert.deepEqual(
    await takeDistributedRateLimit([["all", 3, 300000]], "127.0.0.2", stub, valid),
    { allowed: false, retryAfter: 61 },
  );
});

test("Missing credentials, upstream failures and malformed results do not allow requests", async () => {
  await assert.rejects(
    takeDistributedRateLimit([["all", 2, 60000]], "127.0.0.1", async () => Response.json({ result: [1, 0] }), {}),
  );
  await assert.rejects(
    takeDistributedRateLimit([["all", 2, 60000]], "127.0.0.1", async () => Response.json({ error: "bad" }, { status: 401 }), valid),
  );
  await assert.rejects(
    takeDistributedRateLimit([["all", 2, 60000]], "127.0.0.1", async () => Response.json({ result: "not-an-array" }), valid),
  );
});
