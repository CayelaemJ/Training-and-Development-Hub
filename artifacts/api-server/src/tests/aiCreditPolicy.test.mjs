import test from "node:test";
import assert from "node:assert/strict";
import { PLANS, PACKS, OPERATION_COST, costOf, effectivePlan, monthStart, balance, chargeFrom, paystackSignatureValid } from "../lib/aiCreditPolicy.ts";

// ---- costOf ----
test("costOf returns configured cost for known operations", () => {
  assert.equal(costOf("material_qa"), 1);
  assert.equal(costOf("learner_support"), 1);
  assert.equal(costOf("quiz"), 1);
  assert.equal(costOf("written_exam"), 2);
  assert.equal(costOf("development_plan"), 2);
  assert.equal(costOf("grading"), 0);
});
test("costOf defaults to 1 for unknown operations", () => {
  assert.equal(costOf("mystery_operation"), 1);
  assert.equal(costOf(""), 1);
});

// ---- effectivePlan ----
const NOW = new Date("2026-11-23T10:00:00Z");
const FUTURE = new Date("2026-12-31T00:00:00Z");
const PAST = new Date("2026-11-01T00:00:00Z");

test("effectivePlan returns subscribed plan when active and not expired", () => {
  const sub = { plan: "plus", status: "active", currentPeriodEnd: FUTURE };
  assert.equal(effectivePlan(sub, ["learner"], NOW), "plus");
  assert.equal(effectivePlan({ ...sub, plan: "pro" }, [], NOW), "pro");
});
test("effectivePlan falls back when subscription expired", () => {
  const sub = { plan: "plus", status: "active", currentPeriodEnd: PAST };
  assert.equal(effectivePlan(sub, ["learner"], NOW), "free");
});
test("effectivePlan falls back when subscription inactive", () => {
  const sub = { plan: "plus", status: "cancelled", currentPeriodEnd: FUTURE };
  assert.equal(effectivePlan(sub, ["learner"], NOW), "free");
});
test("effectivePlan returns educator for staff roles without subscription", () => {
  assert.equal(effectivePlan(null, ["teacher"], NOW), "educator");
  assert.equal(effectivePlan(null, ["owner"], NOW), "educator");
  assert.equal(effectivePlan(null, ["admin"], NOW), "educator");
  assert.equal(effectivePlan(null, ["assessor"], NOW), "educator");
});
test("effectivePlan returns free for learners without subscription", () => {
  assert.equal(effectivePlan(null, ["learner"], NOW), "free");
  assert.equal(effectivePlan(null, [], NOW), "free");
});
test("effectivePlan ignores unknown plan codes from subscription", () => {
  const sub = { plan: "enterprise", status: "active", currentPeriodEnd: FUTURE };
  assert.equal(effectivePlan(sub, ["learner"], NOW), "free");
});

// ---- monthStart ----
test("monthStart returns first of the month in UTC", () => {
  const ms = monthStart(new Date("2026-11-23T15:30:00Z"));
  assert.equal(ms.toISOString(), "2026-11-01T00:00:00.000Z");
});
test("monthStart handles January correctly", () => {
  const ms = monthStart(new Date("2026-01-15T00:00:00Z"));
  assert.equal(ms.toISOString(), "2026-01-01T00:00:00.000Z");
});

// ---- balance ----
test("balance reports correct totals for free plan with no top-ups", () => {
  const b = balance("free", 10, 0);
  assert.equal(b.plan, "free");
  assert.equal(b.allowance, PLANS.free.monthlyCredits);
  assert.equal(b.usedThisMonth, 10);
  assert.equal(b.allowanceLeft, PLANS.free.monthlyCredits - 10);
  assert.equal(b.topUpLeft, 0);
  assert.equal(b.total, PLANS.free.monthlyCredits - 10);
});
test("balance clamps allowanceLeft at zero when over-used", () => {
  const b = balance("free", 999, 50);
  assert.equal(b.allowanceLeft, 0);
  assert.equal(b.topUpLeft, 50);
  assert.equal(b.total, 50);
});
test("balance clamps topUpLeft at zero when negative", () => {
  const b = balance("pro", 0, -5);
  assert.equal(b.topUpLeft, 0);
  assert.equal(b.total, PLANS.pro.monthlyCredits);
});
test("balance for pro plan with top-up", () => {
  const b = balance("pro", 500, 150);
  assert.equal(b.allowance, PLANS.pro.monthlyCredits);
  assert.equal(b.allowanceLeft, 500);
  assert.equal(b.topUpLeft, 150);
  assert.equal(b.total, 650);
});

// ---- chargeFrom ----
test("chargeFrom returns usage when allowance covers the cost", () => {
  const b = balance("plus", 100, 0);
  assert.equal(chargeFrom(b, 1), "usage");
  assert.equal(chargeFrom(b, 200), "usage"); // 300-100=200 left
});
test("chargeFrom returns usage_topup when allowance exhausted but top-up available", () => {
  const b = balance("free", 30, 50); // allowanceLeft=0, topUpLeft=50
  assert.equal(chargeFrom(b, 1), "usage_topup");
  assert.equal(chargeFrom(b, 50), "usage_topup");
});
test("chargeFrom returns null when neither pot covers the cost", () => {
  const b = balance("free", 30, 0);
  assert.equal(chargeFrom(b, 1), null);
});
test("chargeFrom always returns usage for zero-cost operations", () => {
  const exhausted = balance("free", 999, -5);
  assert.equal(chargeFrom(exhausted, 0), "usage");
});
test("chargeFrom tries allowance before top-up", () => {
  // allowanceLeft=5, topUpLeft=100; cost=5 → allowance
  const b = balance("free", 25, 100);
  assert.equal(chargeFrom(b, 5), "usage");
});

// ---- paystackSignatureValid ----
function fakeHmac(secret, body) {
  // Deterministic fake: hex of "sig:" + secret + ":" + body length
  return Buffer.from(`sig:${secret}:${body.length}`).toString("hex").padEnd(128, "0").slice(0, 128);
}
function constantTimeEqual(a, b) { return a === b; }

test("paystackSignatureValid accepts a correct signature", () => {
  const secret = "sk_test_abc";
  const body = Buffer.from("payload");
  const sig = fakeHmac(secret, body);
  assert.ok(paystackSignatureValid(body, sig, secret, fakeHmac, constantTimeEqual));
});
test("paystackSignatureValid rejects a wrong signature", () => {
  const secret = "sk_test_abc";
  const body = Buffer.from("payload");
  assert.ok(!paystackSignatureValid(body, "wrong".padEnd(128, "0"), secret, fakeHmac, constantTimeEqual));
});
test("paystackSignatureValid rejects non-string signature", () => {
  const body = Buffer.from("payload");
  assert.ok(!paystackSignatureValid(body, null, "sk_test", fakeHmac, constantTimeEqual));
  assert.ok(!paystackSignatureValid(body, 42, "sk_test", fakeHmac, constantTimeEqual));
  assert.ok(!paystackSignatureValid(body, undefined, "sk_test", fakeHmac, constantTimeEqual));
});
test("paystackSignatureValid rejects signature not matching hex-128 pattern", () => {
  const body = Buffer.from("payload");
  assert.ok(!paystackSignatureValid(body, "tooshort", "sk_test", fakeHmac, constantTimeEqual));
  assert.ok(!paystackSignatureValid(body, "g".repeat(128), "sk_test", fakeHmac, constantTimeEqual)); // 'g' not hex
});
test("paystackSignatureValid rejects empty secret", () => {
  const body = Buffer.from("payload");
  const sig = fakeHmac("sk_test", body);
  assert.ok(!paystackSignatureValid(body, sig, "", fakeHmac, constantTimeEqual));
});
test("paystackSignatureValid is case-insensitive on signatures", () => {
  const secret = "sk_test_abc";
  const body = Buffer.from("payload");
  const sig = fakeHmac(secret, body).toUpperCase();
  assert.ok(paystackSignatureValid(body, sig, secret, fakeHmac, constantTimeEqual));
});
