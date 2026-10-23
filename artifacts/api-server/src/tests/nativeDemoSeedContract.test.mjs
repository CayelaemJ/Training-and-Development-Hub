import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const seed = readFileSync("artifacts/api-server/src/lib/demoSeed.ts", "utf8");
const start = readFileSync("scripts/render-native-test-start.sh", "utf8");
const guard = readFileSync("lib/db/scripts/native-test-db-guard.mjs", "utf8");

test("synthetic study fixtures cannot be seeded into an ordinary database", () => {
  assert.match(seed, /CABO_TEST_DATABASE_ISOLATED/);
  assert.match(seed, /ENABLE_CABO_DEMO_SEED/);
  assert.match(seed, /CABO_ENVIRONMENT/);
  assert.match(seed, /example\.invalid/);
  assert.match(seed, /\[DEMO\]/);
});
test("native learner practice data contains owned notes and server-graded sample questions", () => {
  assert.match(seed, /Grade 12 Algebra/);
  assert.match(seed, /English Text Analysis/);
  assert.match(seed, /studyMaterialsTable/);
  assert.match(seed, /quizzesTable/);
  assert.match(seed, /extracted_text=/);
  assert.match(seed, /allow_ai_reading=false/);
  assert.match(seed, /synthetic-demo-no-ai/);
  assert.match(seed, /eq\(quizzesTable\.userId, owner\)/);
  assert.doesNotMatch(seed, /openai\.com|groq\.com|https:\/\/.*api/);
});
test("isolated test deploy refuses to push a schema to an unmarked existing database", () => {
  assert.match(guard, /tables\.rows\.length === 0/);
  assert.match(guard, /Existing unmarked database: refusing bootstrap/);
  assert.match(guard, /Test database deployment marker mismatch/);
  assert.match(start, /native-test-db-guard\.mjs check/);
  assert.match(start, /if \[\[ "\$mode" == "EMPTY" \]\]/);
  assert.match(start, /elif \[\[ "\$mode" == "READY" \]\]/);
});

test("unconfigured staging runs a non-API pending page rather than opening sign-in", () => {
  const pending = readFileSync("scripts/native-preview-pending.mjs", "utf8");
  assert.match(start, /native-preview-pending\.mjs/);
  assert.match(start, /-z "\$\{DATABASE_URL:-\}"/);
  assert.match(pending, /req\.url === "\/" && req\.method === "GET"/);
  assert.match(pending, /writeHead\(503/);
  assert.match(pending, /test_setup_pending/);
  assert.doesNotMatch(pending, /api\/native\/test-login|createSession|DATABASE_URL/);
});
