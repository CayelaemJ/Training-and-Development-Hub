import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { scryptSync } from "node:crypto";

const command = "scripts/generate-demo-login-config.mjs";
const demoPassword = "five"; // Arbitrary weak test input, never a deployed password.
const env = {
  ...process.env,
  NODE_ENV: "test",
  CABO_ENVIRONMENT: "testing",
  CABO_TEST_DATABASE_ISOLATED: "true",
  CABO_DEMO_PASSWORD: demoPassword,
  CABO_ALLOW_WEAK_DEMO_PASSWORD: "true",
};
const run = overrides => spawnSync(process.execPath, [command], {
  encoding: "utf8", env: { ...env, ...overrides }, maxBuffer: 1024 * 1024,
});

test("demo credentials map to every synthetic fixture identity with independent salts", () => {
  const result = run({});
  assert.equal(result.status, 0, result.stderr);
  const accounts = JSON.parse(result.stdout);
  assert.equal(accounts.length, 14);
  assert.equal(new Set(accounts.map(x => x.username)).size, accounts.length);
  assert.equal(new Set(accounts.map(x => x.userId)).size, accounts.length);
  assert.equal(new Set(accounts.map(x => x.hash.split(":")[0])).size, accounts.length);
  assert.equal(accounts.find(x => x.username === "cabo_parent_south")?.userId, "cabo-fixture-parent-south");
  assert.equal(accounts.find(x => x.username === "cabo_learner_south_c")?.email, "learner-south-c@example.invalid");
  assert.ok(accounts.every(x => x.email.endsWith("@example.invalid")));
  assert.ok(!result.stdout.includes(demoPassword));
  for (const account of accounts) {
    assert.match(account.hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    const [saltHex, hashHex] = account.hash.split(":");
    assert.equal(scryptSync(demoPassword, Buffer.from(saltHex, "hex"), 64).toString("hex"), hashHex);
  }
});

test("generator refuses production, shared data or a missing password", () => {
  for (const changes of [
    { CABO_ENVIRONMENT: "production" },
    { CABO_TEST_DATABASE_ISOLATED: "false" },
    { NODE_ENV: "production" },
    { CABO_DEMO_PASSWORD: "" },
  ]) {
    const result = run(changes);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
  }
});

test("weak demo passwords require separate explicit consent", () => {
  const denied = run({ CABO_ALLOW_WEAK_DEMO_PASSWORD: "false" });
  assert.notEqual(denied.status, 0);
  assert.equal(denied.stdout, "");
  const permitted = run({});
  assert.equal(permitted.status, 0, permitted.stderr);
});
