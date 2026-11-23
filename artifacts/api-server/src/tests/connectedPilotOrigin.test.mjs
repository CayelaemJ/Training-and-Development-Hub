import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pilot = "https://cabo-learning-hub-pilot.onrender.com";
const root = new URL("../../../../", import.meta.url);
const source = path => readFileSync(new URL(path, root), "utf8");

test("connected builds target the shared Render pilot", () => {
  assert.equal(source("native-apps/android/app/build.gradle.kts").match(/val publicOrigin = "([^"]+)"/)?.[1], pilot);
  assert.equal(source("native-apps/ios/project.yml").match(/^\s*CABO_API_ORIGIN:\s*(\S+)$/m)?.[1], pilot);
  assert.equal(source("native-apps/ios/NativeSession.swift").match(/return URL\(string: "(https:\/\/[^"]+)"\)!/)?.[1], pilot);
  const windowsHost = source("native-apps/windows/CABO.Native.Core/NativeLearningService.cs").match(/const string PilotHost = "([^"]+)"/)?.[1];
  assert.equal(`https://${windowsHost}`, pilot);
  assert.ok(source("artifacts/training-platform/src/lib/schoolApi.ts").includes('fetch("/api" + path'));
});
