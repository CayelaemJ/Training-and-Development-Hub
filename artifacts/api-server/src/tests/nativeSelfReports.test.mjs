import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(p, "utf8");

test("self report endpoint uses authenticated learner ID and draft status", () => {
  const route = read("artifacts/api-server/src/routes/reportCards.ts");
  assert.match(route,/router\.get\("\/reports\/me"/);
  assert.match(route,/gather\(org\.data,req\.user\.id,year\.data\)/);
  assert.match(route,/visibility:"learner_only",status:"draft_preview"/);
  assert.match(route,/Cache-Control","private, no-store"/);
});
test("iOS Android and Windows show only backend-provided self-report summaries", () => {
  const ios=read("native-apps/ios/NativeSession.swift");
  const android=read("native-apps/android/app/src/main/java/za/co/cabosolutions/learninghub/NativeApi.kt");
  const win=read("native-apps/windows/CABO.Native/NativeLearningService.cs");
  for(const client of [ios,android,win]){
    assert.match(client,/api\/reports\/me\?organizationId=/);
    assert.doesNotMatch(client,/faker|mockMarks|testGrade/);
  }
  assert.match(win,/DateTime\.UtcNow\.Year/);
  assert.match(ios,/learnerReports = nextLearnerReports/);
  assert.match(android,/learnerReports = learnerReports/);
});
test("learner report copy is explicitly not an official report card", () => {
  for(const path of [
    "native-apps/ios/NativeHomeView.swift",
    "native-apps/android/app/src/main/java/za/co/cabosolutions/learninghub/MainActivity.kt",
    "native-apps/windows/CABO.Native/MainWindow.xaml",
  ]) assert.match(read(path),/not an officially issued report card/i);
});
