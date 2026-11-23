import test from "node:test";
import assert from "node:assert/strict";
import {
  childProgress, weightedPercentage, trendOf, standingBand, subjectOutlook, attendanceSummary, MIN_COHORT,
} from "../lib/guardianProgressPolicy.ts";
import { identifyCountryScopedSchoolRoute } from "../lib/schoolDataReleasePolicy.ts";
import { readFileSync } from "node:fs";

const periods = [{ id: 1, name: "Term 1" }, { id: 2, name: "Term 2" }];
const mark = (courseId, subject, periodId, marks, weight = 1) => ({ courseId, subject, periodId, marks, maxMarks: 100, weight });
const cohort = (learnerId, courseId, periodId, marks) => ({ learnerId, courseId, periodId, marks, maxMarks: 100, weight: 1 });
const base = { periods, childId: "child", attendance: [], recentResults: [] };

test("weighted percentages follow report-card weighting and ignore invalid rows", () => {
  assert.equal(weightedPercentage([{ marks: 80, maxMarks: 100, weight: 3 }, { marks: 40, maxMarks: 100, weight: 1 }]), 70);
  assert.equal(weightedPercentage([{ marks: 5, maxMarks: 0, weight: 1 }]), null);
  assert.equal(weightedPercentage([{ marks: 150, maxMarks: 100, weight: 1 }]), 100, "clamped");
  assert.equal(weightedPercentage([{ marks: 30, maxMarks: 50, weight: 0 }]), 60, "zero weight counts as 1");
});

test("term-on-term trend needs a change of at least 3 points", () => {
  assert.deepEqual(trendOf(68, 60), { change: 8, trend: "improving" });
  assert.deepEqual(trendOf(61, 60), { change: 1, trend: "steady" });
  assert.deepEqual(trendOf(55, 60), { change: -5, trend: "declining" });
  assert.deepEqual(trendOf(60, null), { change: null, trend: "not_enough_data" });
});

test("standing is a quarter-of-class band with fair handling of ties", () => {
  const scores = [40, 50, 60, 70, 80, 90, 95, 99];
  assert.equal(standingBand(99, scores), "top_quarter");
  assert.equal(standingBand(40, scores), "bottom_quarter");
  assert.equal(standingBand(70, scores), "lower_middle");
  assert.equal(standingBand(80, scores), "upper_middle");
  assert.equal(standingBand(60, [60, 60, 60, 60, 60]), "upper_middle", "everyone equal sits mid-class, not top or bottom");
});

test("subject outlook uses the same 50% threshold as the educator view, plus watch rules", () => {
  assert.equal(subjectOutlook(45, 2).status, "needs_support");
  assert.equal(subjectOutlook(53, 0).status, "watch", "close to threshold");
  assert.equal(subjectOutlook(70, -6).status, "watch", "sharp drop");
  assert.equal(subjectOutlook(70, -2).status, "on_track");
  assert.equal(subjectOutlook(null, null).status, "not_enough_data");
});

test("attendance compares the most recent 20 school days with earlier days", () => {
  const days = [];
  for (let i = 1; i <= 20; i++) days.push({ day: `2026-02-${String(i).padStart(2, "0")}`, status: "present" });
  for (let i = 1; i <= 20; i++) days.push({ day: `2026-03-${String(i).padStart(2, "0")}`, status: i <= 14 ? "present" : "absent" });
  const s = attendanceSummary(days);
  assert.equal(s.recordedDays, 40);
  assert.equal(s.earlierRate, 100);
  assert.equal(s.recentRate, 70);
  assert.equal(s.rate, 85);
  assert.equal(s.trend, "declining");
  assert.equal(attendanceSummary([{ day: "2026-01-05", status: "late" }]).rate, 100, "late counts as attended");
});

test("subjects show per-term results, improvement and the latest term", () => {
  const p = childProgress({ ...base, childMarks: [mark(1, "Maths", 1, 60), mark(1, "Maths", 2, 72), mark(2, "English", 1, 80), mark(2, "English", 2, 74)], cohortMarks: [] });
  const maths = p.subjects.find(s => s.subject === "Maths");
  assert.deepEqual(maths.terms, [{ period: "Term 1", percentage: 60 }, { period: "Term 2", percentage: 72 }]);
  assert.equal(maths.change, 12);
  assert.equal(maths.trend, "improving");
  assert.equal(maths.latestTerm, "Term 2");
  assert.equal(p.overall.current, 73);
  assert.equal(p.overall.previous, 70);
  assert.equal(p.overall.trend, "improving");
  assert.deepEqual(p.highlights.mostImproved, [{ subject: "Maths", change: 12 }]);
  assert.deepEqual(p.highlights.strongest, ["English", "Maths"]);
  assert.equal(p.highlights.focusAreas.find(f => f.subject === "English").status, "watch", "a 6-point drop is flagged");
});

test("class comparison appears only with at least MIN_COHORT results and never names classmates", () => {
  const small = childProgress({ ...base, childMarks: [mark(1, "Maths", 2, 70)], cohortMarks: [cohort("child", 1, 2, 70), cohort("a", 1, 2, 50), cohort("b", 1, 2, 90)] });
  assert.equal(small.subjects[0].standing.available, false);
  assert.match(small.subjects[0].standing.reason, /at least 5 learners/);

  const marks = [70, 40, 55, 65, 85, 90];
  const ids = ["child", "a", "b", "c", "d", "e"];
  const p = childProgress({ ...base, childMarks: [mark(1, "Maths", 2, 70)], cohortMarks: marks.map((m, i) => cohort(ids[i], 1, 2, m)) });
  const s = p.subjects[0].standing;
  assert.equal(MIN_COHORT, 5);
  assert.equal(s.available, true);
  assert.equal(s.cohortSize, 6);
  assert.equal(s.classAverage, 68);
  assert.equal(s.differenceFromAverage, 3);
  assert.equal(s.band, "upper_middle");
  const json = JSON.stringify(p);
  for (const id of ["\"a\"", "\"b\"", "\"c\"", "\"d\"", "\"e\""]) assert.ok(!json.includes(id), `classmate id ${id} must not appear`);
  assert.deepEqual(Object.keys(s).sort(), ["available", "band", "classAverage", "cohortSize", "differenceFromAverage"], "aggregate fields only");
  assert.deepEqual(p.subjects[0].terms, [{ period: "Term 1", percentage: null }, { period: "Term 2", percentage: 70 }], "only the child's own results per term");
});

test("comparison uses only the same subject and the child's latest term", () => {
  const others = ["a", "b", "c", "d", "e"].map(id => cohort(id, 1, 1, 30)); // Term 1 only
  const p = childProgress({ ...base, childMarks: [mark(1, "Maths", 1, 60), mark(1, "Maths", 2, 70)], cohortMarks: [...others, cohort("child", 1, 2, 70), ...["a", "b", "c"].map(id => cohort(id, 2, 2, 99))] });
  assert.equal(p.subjects[0].standing.available, false, "Term 1 and other-subject results are not mixed into the Term 2 comparison");
});

test("overall outlook escalates for low subjects or low attendance and explains why", () => {
  const ok = childProgress({ ...base, childMarks: [mark(1, "Maths", 2, 75)], cohortMarks: [] });
  assert.equal(ok.outlook.status, "on_track");
  const low = childProgress({ ...base, childMarks: [mark(1, "Maths", 2, 42)], cohortMarks: [] });
  assert.equal(low.outlook.status, "needs_support");
  const absent = childProgress({ ...base, childMarks: [mark(1, "Maths", 2, 75)], cohortMarks: [], attendance: Array.from({ length: 10 }, (_, i) => ({ day: `2026-03-${10 + i}`, status: i < 7 ? "present" : "absent" })) });
  assert.equal(absent.outlook.status, "needs_support");
  assert.match(absent.outlook.reasons.join(" "), /attendance is below 80%/);
  const none = childProgress({ ...base, childMarks: [], cohortMarks: [] });
  assert.equal(none.outlook.status, "not_enough_data");
  assert.match(none.method.notAPrediction, /not a forecast/);
});

test("recent results are capped at five and marks for unknown terms are ignored", () => {
  const recent = Array.from({ length: 8 }, (_, i) => ({ subject: "Maths", assessment: `Quiz ${i}`, percentage: 70, publishedAt: new Date(2026, 2, i + 1) }));
  const p = childProgress({ ...base, childMarks: [mark(1, "Maths", 99, 10)], cohortMarks: [], recentResults: recent });
  assert.equal(p.recentResults.length, 5);
  assert.equal(p.subjects.length, 0, "marks for a period outside the year are not counted");
});

test("the country pilot gate scopes progress to one school and holds back the children list", () => {
  assert.deepEqual(identifyCountryScopedSchoolRoute("/guardian/progress/learner1", "11"), { kind: "scoped", orgId: 11 });
  assert.equal(identifyCountryScopedSchoolRoute("/guardian/progress/learner1", undefined).kind, "invalid");
  assert.equal(identifyCountryScopedSchoolRoute("/guardian/children", undefined).kind, "unscoped_sensitive");
});

test("progress routes use the same three guardian checks as report cards and published marks only", () => {
  const src = readFileSync(new URL("../routes/guardianProgress.ts", import.meta.url), "utf8");
  assert.match(src, /eq\(guardianRelationshipsTable\.status, "verified"\)/);
  assert.match(src, /canReadChildReport\("verified", decision === "verified", !!enrolment\)/);
  assert.match(src, /eq\(verifiedEnrollmentsTable\.status, "active"\)/);
  assert.equal((src.match(/eq\(academicGradesTable\.status, "published"\)/g) ?? []).length, 2, "child and cohort queries both published-only");
  assert.doesNotMatch(src, /cohortMarks[^;]*res\.json/, "cohort rows are never sent directly");
});
