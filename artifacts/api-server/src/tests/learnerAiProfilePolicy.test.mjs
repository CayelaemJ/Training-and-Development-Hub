import test from "node:test";
import assert from "node:assert/strict";
import { learnerAiProfileInput, emptyLearnerAiProfile } from "../lib/learnerAiProfilePolicy.ts";

test("personalization is off and empty by default", () => {
  assert.equal(emptyLearnerAiProfile.personalizationEnabled, false);
  assert.deepEqual(emptyLearnerAiProfile.goals, []);
  assert.deepEqual(emptyLearnerAiProfile.interests, []);
});

test("profile accepts bounded learner-selected goals and explanation preferences", () => {
  const result = learnerAiProfileInput.safeParse({
    personalizationEnabled: true,
    goals: ["Understand fractions"],
    interests: ["Football"],
    preferredLanguage: "English",
    explanationStyle: "examples_first",
    learningPreferences: ["worked_examples", "check_understanding"],
  });
  assert.equal(result.success, true);
});

test("profile rejects inferred/unknown fields and oversized lists", () => {
  const base = {
    personalizationEnabled: true,
    goals: ["Understand fractions"],
    interests: [],
    preferredLanguage: "English",
    explanationStyle: "step_by_step",
    learningPreferences: [],
  };
  assert.equal(learnerAiProfileInput.safeParse({ ...base, psychologicalProfile: "anxious" }).success, false);
  assert.equal(learnerAiProfileInput.safeParse({ ...base, goals: Array(9).fill("A goal") }).success, false);
  assert.equal(learnerAiProfileInput.safeParse({ ...base, explanationStyle: "therapist" }).success, false);
});
