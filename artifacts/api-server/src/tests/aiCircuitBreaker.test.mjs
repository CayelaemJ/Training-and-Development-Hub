import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cooldownForStatus, createCircuitBreaker } from "../lib/aiCircuitBreaker.ts";

test("cooldowns are short for transient errors and long only for payment required", () => {
  assert.equal(cooldownForStatus(undefined), 10_000);
  assert.equal(cooldownForStatus(503), 10_000);
  assert.equal(cooldownForStatus(429), 30_000);
  assert.equal(cooldownForStatus(401), 60_000);
  assert.equal(cooldownForStatus(403), 60_000);
  assert.equal(cooldownForStatus(402), 30 * 60_000);
});

test("a postponed provider is skipped until its cooldown ends, and success closes it", () => {
  let t = 0;
  const b = createCircuitBreaker(() => t);
  assert.equal(b.remainingMs("groq"), 0);
  b.postpone("groq", 10_000);
  assert.equal(b.remainingMs("groq"), 10_000);
  t = 4_000;
  assert.equal(b.remainingMs("groq"), 6_000);
  b.postpone("groq", 1_000);
  assert.equal(b.remainingMs("groq"), 6_000, "a shorter postpone never shortens an open breaker");
  t = 10_001;
  assert.equal(b.remainingMs("groq"), 0);
  b.postpone("groq", 5_000);
  b.reset("groq");
  assert.equal(b.remainingMs("groq"), 0);
  b.postpone("groq", 10 * 3600_000);
  assert.equal(b.remainingMs("groq"), 3600_000, "capped at one hour");
});

test("completion uses the breaker, closes it on success and caches failed model discovery briefly", () => {
  const src = readFileSync("artifacts/api-server/src/lib/aiCompletion.ts", "utf8");
  assert.match(src, /providerCircuit\.remainingMs\(provider\.name\)/);
  assert.match(src, /providerCircuit\.postpone\(provider\.name, error\.retryAfterSeconds \* 1000\)/);
  assert.match(src, /providerCircuit\.postpone\(provider\.name, cooldownForStatus\(err\.status\)\)/);
  assert.match(src, /providerCircuit\.reset\(provider\.name\)/);
  assert.match(src, /groqModelCache\.expires = Date\.now\(\) \+ 60_000/);
  assert.doesNotMatch(src, /huggingface|HF_TOKEN|OPENAI_API_KEY/, "stays Groq-only");
});
