import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  nativeAuthEnabled, nativeRedirect, validPkceChallenge, validPkceVerifier,
  validState, validCode, randomNativeCode, codeDigest, verifyPkce
} from "../lib/nativeAuthPolicy.ts";

const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
const challenge = createHash("sha256").update(verifier).digest("base64url");

test("native auth is disabled unless explicitly opted in", () => {
  assert.equal(nativeAuthEnabled({}), false);
  assert.equal(nativeAuthEnabled({ CABO_NATIVE_AUTH_ENABLED: "false" }), false);
  assert.equal(nativeAuthEnabled({ CABO_NATIVE_AUTH_ENABLED: "true" }), true);
});
test("only fixed native Android redirect is registered", () => {
  assert.equal(nativeRedirect("cabo-android"), "cabo-learninghub-android://auth");
  assert.equal(nativeRedirect("cabo-ios"), "cabo-learninghub-ios://auth");
  for(const id of ["web", "cabo-windows", "https://evil.test", "", null])
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
