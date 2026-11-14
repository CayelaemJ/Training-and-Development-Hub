import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateRetrieval } from "./ragEvaluation.mjs";
const benchmark = JSON.parse(readFileSync(new URL("../../../../data/rag-eval.synthetic.json", import.meta.url), "utf8"));

test("synthetic benchmark passes configured retrieval quality gates", () => {
  const result = evaluateRetrieval(benchmark.cases, benchmark.thresholds);
  assert.equal(result.passed, true, result.reasons.join(", "));
  assert.equal(result.metrics.tenantLeakageCount, 0);
  assert.equal(result.metrics.recallAtK, 1);
});

test("tenant leakage is a hard failure and metrics omit document content", () => {
  const result = evaluateRetrieval([{ tenantId: "school-a", expectedDocIds: ["doc-a"], retrieved: [{ docId: "doc-a", tenantId: "school-b", text: "private" }] }]);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.includes("Tenant isolation violation"));
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("duplicate documents and poor recall are reported deterministically", () => {
  const result = evaluateRetrieval([{ tenantId: "t", expectedDocIds: ["good"], retrieved: [{ docId: "bad", tenantId: "t" }, { docId: "bad", tenantId: "t" }] }], { maximumDuplicateRate: 0 });
  assert.equal(result.metrics.recallAtK, 0);
  assert.equal(result.metrics.duplicateRate, 0.5);
  assert.equal(result.passed, false);
});

test("rejects malformed benchmark cases and thresholds", () => {
  assert.throws(() => evaluateRetrieval(null));
  assert.throws(() => evaluateRetrieval([], { minimumRecall: 2 }));
  assert.throws(() => evaluateRetrieval([{ tenantId: "t", expectedDocIds: [], retrieved: [{ docId: "x", tenantId: "t", cited: "yes" }] }]));
});
