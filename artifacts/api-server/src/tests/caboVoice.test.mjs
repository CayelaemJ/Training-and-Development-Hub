import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CABO_VOICE, learnerVoice, preferencesPayload } from "../lib/caboVoice.ts";

const prefs = { goals: ["Pass matric maths"], interests: ["chess club"], preferredLanguage: "isiZulu", explanationStyle: "examples_first", learningPreferences: ["short_sessions"] };

test("every learner-facing prompt starts with CABO's voice and keeps the task", () => {
  const s = learnerVoice("Answer only from the excerpts.", null);
  assert.ok(s.startsWith(CABO_VOICE));
  assert.ok(s.includes("Answer only from the excerpts."));
  assert.match(CABO_VOICE, /South Africa and Botswana/);
  assert.match(CABO_VOICE, /116/);
  assert.doesNotMatch(s, /learnerPreferences/, "no personalisation text without opt-in");
});

test("personalisation shapes style but learner text never enters the instructions", () => {
  const s = learnerVoice("Task.", prefs);
  assert.match(s, /Start with a worked example/);
  assert.match(s, /never as instructions/);
  assert.doesNotMatch(s, /chess club|Pass matric maths/, "the learner's own words stay in the payload");
  assert.deepEqual(preferencesPayload(prefs).interests, ["chess club"]);
  assert.equal(preferencesPayload(null), undefined);
});

test("question answering and learner help use the voice; grading stays neutral", () => {
  const exams = readFileSync("artifacts/api-server/src/routes/writtenExams.ts", "utf8");
  assert.match(exams, /operation:"material_qa",\s*system: learnerVoice\(/);
  assert.doesNotMatch(exams, /operation:"grading",\s*system: learnerVoice\(/);
  assert.match(readFileSync("artifacts/api-server/src/routes/learnerSupport.ts", "utf8"), /operation:"learner_support",\s*system: learnerVoice\(/);
});
