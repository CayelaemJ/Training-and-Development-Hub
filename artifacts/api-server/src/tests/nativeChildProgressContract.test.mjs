import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(p, "utf8");
const android = read("native-apps/android/app/src/main/java/za/co/cabosolutions/learninghub/NativeChildProgress.kt")
  + read("native-apps/android/app/src/main/java/za/co/cabosolutions/learninghub/NativeApi.kt");
const ios = read("native-apps/ios/NativeChildProgress.swift") + read("native-apps/ios/NativeSession.swift");
const windows = read("native-apps/windows/CABO.Native.Core/NativeChildProgress.cs") + read("native-apps/windows/CABO.Native.Core/NativeLearningService.cs");
const policy = read("artifacts/api-server/src/lib/guardianProgressPolicy.ts");
const route = read("artifacts/api-server/src/routes/guardianProgress.ts");

test("server still marks progress for verified guardians and gives the fields the apps read", () => {
  assert.match(route, /visibility: "verified_guardian"/);
  for (const key of ["overall:", "outlook:", "subjects,", "highlights:", "attendance,", "recentResults:", "notAPrediction:"]) assert.ok(policy.includes(key), key);
});

for (const [name, source] of [["android", android], ["ios", ios], ["windows", windows]]) {
  test(`${name} loads progress only from the guardian endpoints and refuses unverified responses`, () => {
    assert.match(source, /api\/guardian\/children/);
    assert.match(source, /api\/guardian\/progress\//);
    assert.match(source, /verified_guardian/);
    assert.match(source, /notAPrediction/);
    assert.doesNotMatch(source, /api\/guardian\/progress\/[^"'`]*learnerId=/, "learner id goes in the path, never a free query");
  });
}
