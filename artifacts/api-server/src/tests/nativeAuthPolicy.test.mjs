import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  isolatedDemoBrowserLoginEnabled, nativeAuthEnabled, nativeDemoReturnTo, nativeRedirect, validPkceChallenge, validPkceVerifier,
  validState, validCode, randomNativeCode, codeDigest, verifyPkce
} from "../lib/nativeAuthPolicy.ts";

const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
const challenge = createHash("sha256").update(verifier).digest("base64url");

test("ordinary native auth requires opt-in", () => {
  assert.equal(nativeAuthEnabled({}), false);
  assert.equal(nativeAuthEnabled({ CABO_NATIVE_AUTH_ENABLED: "false" }), false);
  assert.equal(nativeAuthEnabled({ CABO_NATIVE_AUTH_ENABLED: "true" }), true);
});
test("only fixed native callbacks are registered", () => {
  assert.equal(nativeRedirect("cabo-android"), "cabo-learninghub-android://auth");
  assert.equal(nativeRedirect("cabo-ios"), "cabo-learninghub-ios://auth");
  assert.equal(nativeRedirect("cabo-windows"), "http://127.0.0.1:47787/auth");
  for(const id of ["web", "https://evil.test", "http://127.0.0.1:9000/auth", "", null])
    assert.equal(nativeRedirect(id), null);
});
test("PKCE RFC7636 S256 validates exact verifier and challenge", () => {
  assert.equal(validPkceVerifier(verifier), true);
  assert.equal(validPkceChallenge(challenge), true);
  assert.equal(verifyPkce(verifier, challenge), true);
  assert.equal(verifyPkce("x".repeat(64), challenge), false);
  assert.equal(verifyPkce("short", challenge), false);
  assert.equal(validState("1".repeat(32)), true);
  assert.equal(validState("1".repeat(31)), false);
});
test("codes are unpredictable, hash-only server-side and fixed length", () => {
  const one = randomNativeCode(), two = randomNativeCode();
  assert.equal(validCode(one), true);
  assert.notEqual(one, two);
  assert.notEqual(codeDigest(one), one);
  assert.equal(codeDigest(one).length, 64);
  assert.equal(validCode("hello"), false);
});

const demoEnv = {
  CABO_ENVIRONMENT: "testing",
  CABO_TEST_DATABASE_ISOLATED: "true",
  ENABLE_CABO_TEST_LOGIN: "true",
};

test("browser demo handoff requires an isolated testing database and enabled web sign-in", () => {
  assert.equal(isolatedDemoBrowserLoginEnabled(demoEnv), true);
  assert.equal(nativeAuthEnabled(demoEnv), true);
  assert.equal(nativeAuthEnabled({ ...demoEnv, CABO_NATIVE_AUTH_ENABLED: "false" }), false);
  for (const key of Object.keys(demoEnv)) {
    const env = { ...demoEnv, [key]: undefined };
    assert.equal(isolatedDemoBrowserLoginEnabled(env), false);
    assert.equal(nativeAuthEnabled(env), false);
  }
});

test("demo return path preserves only a valid registered-client PKCE request", () => {
  const state = "K".repeat(43);
  for (const client of ["cabo-android", "cabo-windows", "cabo-ios"]) {
    const path = `/api/native/authorize?client_id=${client}&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;
    assert.equal(nativeDemoReturnTo(path), path);
    for (const invalid of [
      "https://example.test" + path,
      "//example.test" + path,
      path + "&redirect_uri=https%3A%2F%2Fexample.test",
      path + "&client_id=cabo-android",
      path + "#fragment",
      path.replace(client, "unknown-client"),
      path.replace(state, "short"),
      path.replace("S256", "plain"),
    ]) assert.equal(nativeDemoReturnTo(invalid), null, invalid);
  }
});
