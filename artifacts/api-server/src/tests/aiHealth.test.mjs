import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAiHealthCheck, validHealthAnswer, AI_HEALTH_PAYLOAD } from "../lib/aiHealth.ts";

function fakeClock() {
  let t = 1_000_000;
  return { now: () => t, advance: ms => { t += ms; } };
}

test("a valid synthetic answer reports healthy with model and latency", async () => {
  const clock = fakeClock();
  const calls = [];
  const check = createAiHealthCheck({
    configured: () => true, now: clock.now,
    complete: async args => { calls.push(args); clock.advance(420); args.validate({ ok: true, sum: 5 }); return { modelId: "openai/gpt-oss-120b" }; },
  });
  const r = await check();
  assert.equal(r.status, "healthy");
  assert.equal(r.model, "openai/gpt-oss-120b");
  assert.equal(r.latencyMs, 420);
  assert.equal(r.cached, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, "provider_smoke_test");
  assert.deepEqual(calls[0].payload, AI_HEALTH_PAYLOAD, "only the fixed synthetic payload is sent");
  assert.ok(calls[0].maxCompletionTokens <= 100, "the check stays tiny");
});

test("results are cached and concurrent callers share one AI call", async () => {
  const clock = fakeClock();
  let calls = 0;
  const check = createAiHealthCheck({
    configured: () => true, now: clock.now, ttlMs: 600_000,
    complete: async () => { calls++; await new Promise(r => setTimeout(r, 5)); return { modelId: "m" }; },
  });
  const [a, b, c] = await Promise.all([check(), check(), check()]);
  assert.equal(calls, 1, "single flight");
  assert.deepEqual([a.status, b.status, c.status], ["healthy", "healthy", "healthy"]);
  clock.advance(599_000);
  assert.equal((await check()).cached, true);
  assert.equal(calls, 1);
  clock.advance(2_000);
  await check();
  assert.equal(calls, 2, "refreshes after the cache expires");
});

test("missing provider, provider errors, wrong answers and timeouts are not healthy and leak nothing", async () => {
  const none = createAiHealthCheck({ configured: () => false, complete: async () => { throw new Error("must not be called"); } });
  assert.equal((await none()).status, "not_configured");

  const failing = createAiHealthCheck({ configured: () => true, complete: async () => { throw new Error("401 invalid key sk-secret-value"); } });
  const f = await failing();
  assert.equal(f.status, "unavailable");
  assert.doesNotMatch(JSON.stringify(f), /secret|401|invalid key/, "provider errors are never returned");

  const wrong = createAiHealthCheck({ configured: () => true, complete: async args => { args.validate({ ok: true, sum: 4 }); return { modelId: "m" }; } });
  assert.equal((await wrong()).status, "unavailable");

  const slow = createAiHealthCheck({ configured: () => true, timeoutMs: 20, complete: () => new Promise(() => {}) });
  assert.equal((await slow()).status, "unavailable");
});

test("the validator accepts only the exact expected answer", () => {
  assert.equal(validHealthAnswer({ ok: true, sum: 5 }), true);
  for (const bad of [null, {}, { ok: false, sum: 5 }, { ok: true, sum: 6 }, { ok: "true", sum: 5 }]) assert.throws(() => validHealthAnswer(bad));
});

test("the public route uses the cached check and answers 503 unless healthy", () => {
  const route = readFileSync("artifacts/api-server/src/routes/health.ts", "utf8");
  assert.match(route, /router\.get\("\/healthz\/ai"/);
  assert.match(route, /createAiHealthCheck\(\{ complete: completeAIJson, configured: hasAiProvider \}\)/);
  assert.match(route, /status\(result\.status === "healthy" \? 200 : 503\)/);
});
