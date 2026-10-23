import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = (relative) => readFileSync(resolve(process.cwd(), relative), "utf8");

test("Android offers API 23+ without mandatory expensive hardware features", () => {
  const gradle = file("native-apps/android/app/build.gradle.kts");
  const manifest = file("native-apps/android/app/src/main/AndroidManifest.xml");
  assert.match(gradle, /minSdk\s*=\s*23\b/);
  assert.match(manifest, /usesCleartextTraffic="false"/);
  assert.match(manifest, /allowBackup="false"/);
  assert.doesNotMatch(manifest, /uses-feature[^>]+required="true"/);
});

test("Android classroom UI adapts at 600dp and phone UI remains available", () => {
  const ui = file("native-apps/android/app/src/main/java/za/co/cabosolutions/learninghub/MainActivity.kt");
  assert.match(ui, /maxWidth\s*>=\s*600\.dp/);
  assert.match(ui, /role\s*==\s*"parent"/);
  assert.match(ui, /respondToInvite/);
  assert.match(ui, /teacher/);
  assert.match(ui, /learner/);
  assert.doesNotMatch(ui, /WebView\s*\(/);
});

test("iOS includes iOS 15 compatibility and registered native auth callback", () => {
  const project = file("native-apps/ios/project.yml");
  const ui = file("native-apps/ios/NativeHomeView.swift");
  const plist = file("native-apps/ios/Info.plist");
  assert.match(project, /deploymentTarget:\s*"15\.0"/);
  assert.match(ui, /NavigationView\s*\{/);
  assert.match(ui, /sizeClass\s*==\s*\.regular/);
  assert.match(ui, /decideGuardian/);
  assert.match(plist, /cabo-learninghub-ios/);
  assert.doesNotMatch(ui, /WKWebView\s*\(/);
});

test("private child names are guarded in native parent API projection", () => {
  const source = file("artifacts/api-server/src/lib/parentMobilePolicy.ts");
  assert.match(source, /status\s*===\s*"verified"/);
  assert.match(source, /activeLearnerIds\.has/);
  assert.match(source, /learnerName:\s*readAllowed/);
});

test("Windows uses native WinUI, loopback PKCE and DPAPI rather than a browser wrapper", () => {
  const project = file("native-apps/windows/CABO.Native/CABO.Native.csproj");
  const client = file("native-apps/windows/CABO.Native/NativeLearningService.cs");
  const window = file("native-apps/windows/CABO.Native/MainWindow.xaml.cs");
  assert.match(project, /<UseWinUI>true<\/UseWinUI>/);
  assert.match(client, /IPAddress\.Loopback/);
  assert.match(client, /code_challenge_method=S256/);
  assert.match(client, /ProtectedData\.Protect/);
  assert.match(client, /ProtectedData\.Unprotect/);
  assert.match(client, /api\/portal\/me/);
  assert.match(client, /api\/native\/logout/);
  assert.match(window, /NativeLearningService/);
  assert.doesNotMatch(client, /WebView2|WebView\s*\(/);
});

test("Windows learner can take assigned practice quizzes with real graded feedback", () => {
  const view = file("native-apps/windows/CABO.Native/MainWindow.xaml");
  const controller = file("native-apps/windows/CABO.Native/NativeQuizWindow.cs");
  const api = file("native-apps/windows/CABO.Native/NativeLearningService.cs");
  assert.match(view, /QuizSelected/);
  assert.match(view, /QuizSubmitButton/);
  assert.match(view, /Check saved submission/);
  assert.match(controller, /OpenQuizAsync/);
  assert.match(controller, /SubmitQuizAsync/);
  assert.match(controller, /CheckQuizSubmissionAsync/);
  assert.match(controller, /submitted = true/);
  assert.match(controller, /ShowAttempt/);
  assert.match(api, /Idempotency-Key/);
  assert.match(api, /api\/quizzes\/\{quizId\}\/attempts\/by-key/);
  assert.doesNotMatch(controller, /WebView2|hardcodedCorrectAnswer/);
});
