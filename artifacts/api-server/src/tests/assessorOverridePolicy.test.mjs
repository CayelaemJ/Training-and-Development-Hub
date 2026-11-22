import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { effectiveMarks, latestOverrides, averageEffectivePercentage } from "../lib/assessorOverridePolicy.ts";

const t = s => new Date(`2026-11-22T${s}Z`);
const ai = [
  { questionIndex: 0, awardedMarks: 2, maxMarks: 5 },
  { questionIndex: 1, awardedMarks: 6, maxMarks: 10 },
  { questionIndex: 2, awardedMarks: 0, maxMarks: 5 },
];
const o = (id, questionIndex, awardedMarks, at) =>
  ({ id, questionIndex, awardedMarks, assessorId: "assessor-a", reason: "Rubric point missed by AI", createdAt: t(at) });

test("without overrides the effective result equals the AI result and is provisional", () => {
  const r = effectiveMarks(ai, []);
  assert.equal(r.aiAwardedMarks, 8);
  assert.equal(r.effectiveAwardedMarks, 8);
  assert.equal(r.maxMarks, 20);
  assert.equal(r.aiPercentage, 40);
  assert.equal(r.effectivePercentage, 40);
  assert.equal(r.overriddenQuestions, 0);
  assert.ok(r.questions.every(q => !q.overridden && q.override === null));
});

test("an override replaces only its question and keeps the AI mark alongside", () => {
  const r = effectiveMarks(ai, [o(1, 1, 9, "10:00:00")]);
  assert.equal(r.aiAwardedMarks, 8);
  assert.equal(r.effectiveAwardedMarks, 11);
  assert.equal(r.effectivePercentage, 55);
  assert.equal(r.overriddenQuestions, 1);
  const q1 = r.questions.find(q => q.questionIndex === 1);
  assert.equal(q1.aiMarks, 6);
  assert.equal(q1.effectiveMarks, 9);
  assert.equal(q1.override.reason, "Rubric point missed by AI");
  assert.equal(r.questions.find(q => q.questionIndex === 0).effectiveMarks, 2);
});

test("the most recent override wins; equal timestamps fall back to the higher id", () => {
  const later = effectiveMarks(ai, [o(5, 0, 1, "10:00:00"), o(2, 0, 4, "11:00:00")]);
  assert.equal(later.questions[0].effectiveMarks, 4, "later createdAt wins over higher id");
  const tie = latestOverrides([o(3, 0, 1, "10:00:00"), o(7, 0, 3, "10:00:00"), o(4, 0, 2, "10:00:00")]);
  assert.equal(tie.get(0).id, 7);
});

test("an override can lower a mark and can set it to zero", () => {
  const r = effectiveMarks(ai, [o(1, 0, 0, "10:00:00")]);
  assert.equal(r.questions[0].effectiveMarks, 0);
  assert.equal(r.effectiveAwardedMarks, 6);
});

test("out-of-range and unknown-question overrides cannot inflate the score", () => {
  const r = effectiveMarks(ai, [o(1, 2, 99, "10:00:00"), o(2, 7, 50, "10:00:00"), o(3, 1, -4, "10:00:00")]);
  assert.equal(r.questions[2].effectiveMarks, 5, "clamped to question max");
  assert.equal(r.questions[1].effectiveMarks, 0, "negative clamped to zero");
  assert.equal(r.maxMarks, 20, "unknown question index ignored");
  assert.ok(r.effectivePercentage <= 100);
  assert.equal(r.overriddenQuestions, 2);
});

test("average is null without submissions and otherwise the mean of effective percentages", () => {
  assert.equal(averageEffectivePercentage([]), null);
  assert.equal(averageEffectivePercentage([{ effectivePercentage: 40 }, { effectivePercentage: 55 }]), 47.5);
});

test("staff dashboard and submissions use effective marks from organization-scoped overrides", () => {
  const routes = readFileSync(new URL("../routes/organizations.ts", import.meta.url), "utf8");
  const helper = routes.slice(routes.indexOf("async function organizationSubmissions"), routes.indexOf('router.get("/organizations/:orgId/dashboard"'));
  assert.match(helper, /from\(assessorOverridesTable\)[\s\S]*eq\(examAssignmentsTable\.organizationId,orgId\)/);
  assert.match(helper, /effectiveMarks\(row\.feedback/);
  const dashboard = routes.slice(routes.indexOf('router.get("/organizations/:orgId/dashboard"'), routes.indexOf('router.get("/organizations/:orgId/submissions"'));
  assert.match(dashboard, /organizationSubmissions\(oid\.data\)/);
  assert.match(dashboard, /averageEffectiveScore:averageEffectivePercentage\(submissions\)/);
  const list = routes.slice(routes.indexOf('router.get("/organizations/:orgId/submissions"'), routes.indexOf('router.post("/organizations/:orgId/submissions/:submissionId/overrides"'));
  assert.match(list, /guard\(req,res,oid\.data,managers\)/);
  assert.match(list, /organizationSubmissions\(oid\.data\)/);
  // AI marks on the attempt row are never rewritten by the review flow.
  assert.doesNotMatch(routes, /update\(writtenExamAttemptsTable\)/);
});
