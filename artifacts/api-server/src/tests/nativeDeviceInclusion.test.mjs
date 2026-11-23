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
  const client = file("native-apps/windows/CABO.Native.Core/NativeLearningService.cs");
  const callback = file("native-apps/windows/CABO.Native.Core/LoopbackCallback.cs");
  const store = file("native-apps/windows/CABO.Native.Core/SessionStore.cs");
  const window = file("native-apps/windows/CABO.Native/MainWindow.xaml.cs");
  assert.match(project, /<UseWinUI>true<\/UseWinUI>/);
  assert.match(project, /CABO\.Native\.Core\.csproj/);
  assert.match(client, /IPAddress\.Loopback/);
  assert.match(client, /code_challenge_method=S256/);
  assert.match(callback, /FixedTimeEquals/);
  assert.match(store, /ProtectedData\.Protect/);
  assert.match(store, /ProtectedData\.Unprotect/);
  assert.match(store, /DataProtectionScope\.CurrentUser/);
  assert.match(client, /api\/portal\/me/);
  assert.match(client, /api\/native\/logout/);
  assert.match(client, /UseCookies = false/);
  assert.match(client, /AllowAutoRedirect = false/);
  assert.match(window, /NativeLearningService/);
  for (const source of [client, window]) assert.doesNotMatch(source, /WebView2|WebView\s*\(/);
});

test("Windows learner can take assigned practice quizzes with real graded feedback", () => {
  const controller = file("native-apps/windows/CABO.Native/Views/LearnerViews.cs");
  const api = file("native-apps/windows/CABO.Native.Core/NativeLearningService.cs");
  assert.match(controller, /OpenQuizAsync/);
  assert.match(controller, /SubmitQuizAsync/);
  assert.match(controller, /CheckQuizSubmissionAsync/);
  assert.match(controller, /Check saved result/);
  assert.match(controller, /submitted = true/);
  assert.match(api, /Idempotency-Key/);
  assert.match(api, /api\/quizzes\/\{quizId\}\/attempts\/by-key/);
  // A lost submit response must never be retried as a second POST.
  assert.match(api, /method == HttpMethod\.Get \? 2 : 1/);
  assert.doesNotMatch(controller, /WebView2|hardcodedCorrectAnswer/);
});

test("Windows previews user-owned study materials with paging and session cleanup", () => {
  const controller = file("native-apps/windows/CABO.Native/Views/LearnerViews.cs");
  const main = file("native-apps/windows/CABO.Native/MainWindow.xaml.cs");
  const api = file("native-apps/windows/CABO.Native.Core/NativeLearningService.cs");
  assert.match(controller, /Read next section/);
  assert.match(controller, /ReadMaterialAsync/);
  assert.match(controller, /next = page\.NextOffset/);
  assert.match(main, /ContentHost\.Children\.Clear\(\)/);
  assert.match(main, /SessionEnded/);
  assert.match(api, /api\/materials\/\{id\}\/preview\?offset=\{offset\}/);
  assert.doesNotMatch(controller, /File\.WriteAll|WebView2|cachedPassword/);
});
