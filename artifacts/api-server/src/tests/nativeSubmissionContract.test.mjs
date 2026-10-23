import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isTestSuperadmin } from "../lib/platformPolicy.ts";

const src = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("superadmin never activates in production even with leaked test flags", () => {
  const id = "cabo-isolated-test-learner";
  const enabled = {
    CABO_ENVIRONMENT: "testing", ENABLE_CABO_SUPERADMIN: "true",
    CABO_SUPERADMIN_USER_ID: id
  };
  assert.equal(isTestSuperadmin(id, enabled), true);
  assert.equal(isTestSuperadmin("someone-else", enabled), false);
  assert.equal(isTestSuperadmin(id, { ...enabled, CABO_ENVIRONMENT: "production" }), false);
  assert.equal(isTestSuperadmin(id, { ...enabled, ENABLE_CABO_SUPERADMIN: "false" }), false);
  assert.equal(isTestSuperadmin(id, { ...enabled, CABO_SUPERADMIN_USER_ID: "" }), false);
});

test("quiz attempt uniqueness requires migration and explicit environment flag", () => {
  const migration = src("lib/db/migrations/20261023_quiz_idempotency.sql");
  const schema = src("lib/db/src/schema/training.ts");
  const server = src("artifacts/api-server/src/routes/training.ts");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS request_key/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS uq_quiz_attempts_user_request_key/);
  assert.match(schema, /requestKey: varchar\("request_key"/);
  assert.match(server, /CABO_QUIZ_IDEMPOTENCY_ENABLED === "true"/);
  assert.match(server, /onConflictDoNothing\(\)/);
  assert.match(server, /existing\.quizId !== quiz\.id/);
  assert.match(server, /eq\(quizAttemptsTable\.userId, req\.user\.id\)/);
  assert.match(server, /router\.get\("\/quizzes\/:id\/attempts\/by-key\/:key"/);
});

test("native devices reuse a request key and never blindly repeat an uncertain POST", () => {
  const swift = src("native-apps/ios/NativeQuizView.swift");
  const android = src("native-apps/android/app/src/main/java/za/co/cabosolutions/learninghub/MainActivity.kt");
  const api = src("native-apps/android/app/src/main/java/za/co/cabosolutions/learninghub/NativeApi.kt");
  assert.match(swift, /requestKey = UUID\(\)\.uuidString/);
  assert.match(swift, /submissionUnconfirmed = true/);
  assert.match(swift, /session\.findSubmittedQuiz/);
  assert.match(android, /submissionKey = java\.util\.UUID\.randomUUID\(\)\.toString\(\)/);
  assert.match(android, /studyUnconfirmed = true/);
  assert.match(android, /api\.lookupQuiz\(id, submissionKey\)/);
  assert.match(api, /Idempotency-Key/);
});
