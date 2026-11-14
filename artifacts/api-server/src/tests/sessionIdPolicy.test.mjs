import test from "node:test";
import assert from "node:assert/strict";
import { isSessionId, sessionIdFromCredentials } from "../lib/sessionIdPolicy.ts";

const valid = "a".repeat(64);

test("accepts only generated 32-byte lowercase hexadecimal session identifiers", () => {
  assert.equal(isSessionId(valid), true);
  for (const value of [undefined, null, "", "a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64), 42]) {
    assert.equal(isSessionId(value), false);
  }
});

test("extracts well-formed bearer and cookie session identifiers", () => {
  assert.equal(sessionIdFromCredentials(`Bearer ${valid}`, undefined), valid);
  assert.equal(sessionIdFromCredentials(`bearer ${valid}`, undefined), valid);
  assert.equal(sessionIdFromCredentials(undefined, valid), valid);
});

test("rejects malformed bearer credentials without falling back to a cookie", () => {
  assert.equal(sessionIdFromCredentials("Bearer invalid", valid), undefined);
  assert.equal(sessionIdFromCredentials(`Bearer ${"a".repeat(63)}`, valid), undefined);
  assert.equal(sessionIdFromCredentials(`Bearer ${valid} extra`, valid), undefined);
});

test("non-bearer authorization schemes do not override a valid session cookie", () => {
  assert.equal(sessionIdFromCredentials("Basic abc", valid), valid);
});
