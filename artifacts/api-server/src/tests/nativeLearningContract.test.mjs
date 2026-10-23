import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Source-contract checks only. Real Xcode/iPhone/backend integration must
// separately validate these code paths and are never implied by these tests.
const source = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("iOS project includes independent native quiz and material-reading views", () => {
  const project = source("native-apps/ios/project.yml");
  const home = source("native-apps/ios/NativeHomeView.swift");
  for (const file of ["NativeQuizView.swift", "NativeMaterialView.swift"]) {
    assert.ok(project.includes(file), file);
  }
  assert.match(home, /NativeQuizView\(session: session, item: quiz\)/);
  assert.match(home, /NativeMaterialView\(session: session, item: material\)/);
});

test("iOS exam obtains questions and stores only real backend feedback", () => {
  const session = source("native-apps/ios/NativeSession.swift");
  const ui = source("native-apps/ios/NativeQuizView.swift");
  assert.match(session, /request\("api\/quizzes\/\\\(id\)"\)/);
  assert.match(session, /request\("api\/quizzes\/\\\(id\)\/attempts"/);
  assert.match(ui, /submitted\.quizId == quiz\.id/);
  assert.match(ui, /attempt\.feedback/);
  assert.match(ui, /submissionStarted = true/);
  assert.match(ui, /Do not submit again yet/);
  assert.doesNotMatch(ui, /WKWebView|webView/);
});

test("private material previews are paged and require owner-scoped authentication", () => {
  const route = source("artifacts/api-server/src/routes/training.ts");
  const session = source("native-apps/ios/NativeSession.swift");
  assert.match(route, /router\.get\("\/materials\/:id\/preview"/);
  assert.match(route, /if \(!requireAuth\(req, res\)\) return/);
  assert.match(route, /eq\(studyMaterialsTable\.userId, req\.user\.id\)/);
  assert.match(route, /Cache-Control", "private, no-store"/);
  assert.match(route, /start \+ 16_000/);
  assert.match(route, /allowAiReading: false/);
  assert.match(session, /request\("api\/materials\/\\\(id\)\/preview\?offset=\\\(offset\)"\)/);
});
