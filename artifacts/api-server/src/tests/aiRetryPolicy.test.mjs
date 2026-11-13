import test from "node:test";
import assert from "node:assert/strict";
import { aiFailureAction } from "../lib/aiRetryPolicy.ts";

for (const status of [401, 402, 403, 429, 500, 502, 503, 504]) {
  test(`HTTP ${status} immediately advances to the next provider`, () => {
    for (const jsonMode of [true, false]) {
      assert.equal(aiFailureAction({ status }, jsonMode), "next-provider");
    }
  });
}
for (const name of ["APIConnectionError", "APIConnectionTimeoutError"]) {
  test(`${name} does not multiply calls across models`, () => {
    assert.equal(aiFailureAction({ name }, true), "next-provider");
  });
}
test("missing model allows trying a different model", () => {
  assert.equal(aiFailureAction({ status: 404 }, true), "next-model");
});
test("unsupported JSON mode and invalid output get exactly one format retry", () => {
  for (const error of [{ status: 400 }, { status: 422 }, { name: "SyntaxError" }, { name: "ZodError" }]) {
    assert.equal(aiFailureAction(error, true), "retry-without-json");
    assert.equal(aiFailureAction(error, false), "next-model");
  }
});
test("other HTTP failures do not trigger a redundant format retry", () => {
  assert.equal(aiFailureAction({ status: 413 }, true), "next-model");
});
