import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const seed = readFileSync("artifacts/api-server/src/lib/demoSeed.ts", "utf8");
const docs = readFileSync("docs/CASE_STUDIES_SYNTHETIC_2026-11.md", "utf8");
const catalogue = readFileSync("docs/DEMO_CAPABILITY_CATALOGUE_2026-11.md", "utf8");
const sprint = readFileSync("docs/CASE_STUDY_SPRINT_2026-11-23.md", "utf8");

test("case study seeding remains explicitly isolated and credential-free", () => {
  for(const token of ["CABO_ENVIRONMENT", "CABO_TEST_DATABASE_ISOLATED", "ENABLE_CABO_DEMO_SEED"]) assert.ok(seed.includes(token), token);
  assert.match(seed, /example\.invalid/);
  assert.doesNotMatch(seed, /12345|CABO_TEST_PASSWORD_HASH|CABO_TEST_USERS_JSON/);
  assert.match(seed, /\[DEMO\]/);
});

test("learner dashboard seeding covers user-owned journeys, milestones and grade-matched school records", () => {
  for(const table of ["learnerIdentitiesTable", "learnerJourneysTable", "learnerMilestonesTable", "schoolStageProgressTable"]) assert.ok(seed.includes(table), table);
  assert.match(seed, /source:"self_report"/);
  assert.match(seed, /stage:"highschool",grade:"12",academicYear:2026/);
  assert.match(seed, /learner-south-a/);
  assert.match(seed, /learner-south-b/);
  assert.match(seed, /learner-south-c/);
  assert.match(seed, /university-learner/);
  assert.match(seed, /if\(!existing\)await db\.insert\(learnerJourneysTable\)/);
  assert.match(seed, /if\(!existing\)await db\.insert\(learnerMilestonesTable\)/);
  assert.match(seed, /if\(!existing\)await db\.insert\(schoolStageProgressTable\)/);
});

test("case study assessment narratives correspond to the actual seeded term values", () => {
  for(const title of ["Term 1 — Demo", "Term 2 — Demo", "Term 3 — Demo", "Foundations diagnostic — Synthetic", "Midyear practice — Synthetic", "Algebra Test — Synthetic"]) assert.ok(seed.includes(title), title);
  assert.match(seed, /\["learner-south-b",48\]/);
  assert.match(seed, /\["learner-south-b",56\]/);
  assert.match(seed, /\["learner-south-b",64\]/);
  assert.match(docs, /48\/100 → 56\/100 → 64\/100/);
  assert.match(docs, /70 → 76 → 82/);
  assert.match(seed, /getUTCDay\(\)/);
  assert.match(seed, /onConflictDoNothing\(\)/);
});

test("five case studies have explicit limitations and never claim unmeasured impact", () => {
  for(let i=1;i<=5;i++) assert.match(docs, new RegExp("Case study "+i+" —"));
  assert.match(docs, /not.*real school or learner outcome/i);
  assert.match(docs, /No measured baseline yet/);
  assert.match(docs, /cannot prove/i);
  assert.match(catalogue, /Source implementation/);
  assert.match(catalogue, /Pilot \/ gated/);
  assert.match(catalogue, /Isolated demo verified/);
  assert.match(sprint, /23–29 November 2026/);
  assert.match(sprint, /SYNTHETIC DEMONSTRATION/);
});
