import test from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { demoShortPasswordsAllowed, testPasswordLengthAcceptable, verifyNativeTestLogin } from "../lib/nativeTestLoginPolicy.ts";
import { configuredPrincipals } from "../lib/testPrincipals.ts";

// A deliberately short, fictional demo value used only by this test.
const shortDemo = "abcde";
const isolatedDemo = {
  CABO_ENVIRONMENT: "testing",
  CABO_TEST_DATABASE_ISOLATED: "true",
  CABO_DEMO_SHORT_PASSWORDS: "true",
};

test("short demo passwords need testing env, isolated database and explicit opt-in", () => {
  assert.equal(demoShortPasswordsAllowed(isolatedDemo), true);
  assert.equal(testPasswordLengthAcceptable(shortDemo, isolatedDemo), true);
  for (const [key, value] of [
    ["CABO_ENVIRONMENT", "production"],
    ["CABO_ENVIRONMENT", undefined],
    ["CABO_TEST_DATABASE_ISOLATED", "false"],
    ["CABO_TEST_DATABASE_ISOLATED", undefined],
    ["CABO_DEMO_SHORT_PASSWORDS", "false"],
    ["CABO_DEMO_SHORT_PASSWORDS", undefined],
  ]) {
    const env = { ...isolatedDemo, [key]: value };
    assert.equal(demoShortPasswordsAllowed(env), false, `${key}=${value}`);
    assert.equal(testPasswordLengthAcceptable(shortDemo, env), false, `${key}=${value}`);
  }
});

test("lengths outside the allowed window and non-strings are rejected", () => {
  assert.equal(testPasswordLengthAcceptable("abcd", isolatedDemo), false);
  assert.equal(testPasswordLengthAcceptable("x".repeat(201), isolatedDemo), false);
  assert.equal(testPasswordLengthAcceptable({}, isolatedDemo), false);
  assert.equal(testPasswordLengthAcceptable(undefined, isolatedDemo), false);
  assert.equal(testPasswordLengthAcceptable("x".repeat(11), {}), false);
  assert.equal(testPasswordLengthAcceptable("x".repeat(12), {}), true);
});

test("native demo login accepts a short password only with the isolated demo opt-in", () => {
  const salt = "00112233445566778899aabbccddeeff";
  const env = {
    ...isolatedDemo,
    ENABLE_CABO_TEST_LOGIN: "true",
    ENABLE_CABO_NATIVE_TEST_LOGIN: "true",
    CABO_TEST_LOGIN_USERNAME: "cabo_test",
    CABO_TEST_PASSWORD_HASH: salt + ":" + scryptSync(shortDemo, Buffer.from(salt, "hex"), 64).toString("hex"),
  };
  assert.equal(verifyNativeTestLogin("cabo_test", shortDemo, env), true);
  assert.equal(verifyNativeTestLogin("cabo_test", shortDemo, { ...env, CABO_DEMO_SHORT_PASSWORDS: undefined }), false);
  assert.equal(verifyNativeTestLogin("cabo_test", "abcdf", env), false);
});

test("web test-login applies the same length policy and explains a disabled server", () => {
  const route = readFileSync("artifacts/api-server/src/routes/auth.ts", "utf8");
  assert.match(route, /testPasswordLengthAcceptable\(password,process\.env\)/);
  assert.match(route, /Demo sign-in is not switched on for this server/);
});

test("operator script output for all demo roles parses as valid test principals", async () => {
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync(process.execPath, ["scripts/configure-cabo-test-login.mjs", "--all-demo-roles"], {
    env: { PATH: process.env.PATH, CABO_TEST_SETUP_PASSWORD: shortDemo, CABO_DEMO_SHORT_PASSWORDS: "true" },
    encoding: "utf8",
  });
  const line = out.split("\n").find(l => l.startsWith("CABO_TEST_USERS_JSON="));
  assert.ok(line);
  const principals = configuredPrincipals(line.slice("CABO_TEST_USERS_JSON=".length));
  assert.equal(principals.length, 13);
  assert.equal(new Set(principals.map(p => p.hash.split(":")[0])).size, 13, "each principal has its own salt");
  assert.ok(!out.includes(shortDemo), "script never prints the password");
  const landing = readFileSync("artifacts/training-platform/src/components/cabo-access-landing.tsx", "utf8");
  for (const p of principals) assert.match(landing, new RegExp(`username: '${p.username}'`));
  // Without the opt-in a short password is refused.
  assert.throws(() => execFileSync(process.execPath, ["scripts/configure-cabo-test-login.mjs"], {
    env: { PATH: process.env.PATH, CABO_TEST_SETUP_PASSWORD: shortDemo }, stdio: "pipe",
  }));
});
