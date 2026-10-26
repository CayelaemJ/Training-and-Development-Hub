import test from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { nativeTestLoginEnabled, verifyNativeTestLogin } from "../lib/nativeTestLoginPolicy.ts";
import { readFileSync } from "node:fs";

const examplePassword = "never-use-this-dummy-pilot-password";
const salt = "aabbccddeeff00112233445566778899";
const hash = scryptSync(examplePassword, Buffer.from(salt, "hex"), 64).toString("hex");
const good = {
  CABO_ENVIRONMENT: "testing",
  CABO_TEST_DATABASE_ISOLATED: "true",
  ENABLE_CABO_TEST_LOGIN: "true",
  ENABLE_CABO_NATIVE_TEST_LOGIN: "true",
  CABO_TEST_LOGIN_USERNAME: "cabo_test",
  CABO_TEST_PASSWORD_HASH: salt + ":" + hash,
};

test("native test password grant requires every isolated-pilot gate", () => {
  assert.equal(nativeTestLoginEnabled(good), true);
  assert.equal(verifyNativeTestLogin("cabo_test", examplePassword, good), true);
  for (const [key, value] of [
    ["CABO_ENVIRONMENT", "production"],
    ["CABO_TEST_DATABASE_ISOLATED", "false"],
    ["ENABLE_CABO_TEST_LOGIN", "false"],
    ["ENABLE_CABO_NATIVE_TEST_LOGIN", "false"],
    ["CABO_TEST_LOGIN_USERNAME", "another-account"],
  ]) {
    const env = { ...good, [key]: value };
    assert.equal(nativeTestLoginEnabled(env), false, key);
    assert.equal(verifyNativeTestLogin("cabo_test", examplePassword, env), false, key);
  }
  assert.equal(nativeTestLoginEnabled({ ...good, CABO_ENVIRONMENT: undefined, RAILWAY_ENVIRONMENT_NAME: "production" }), false);
});
test("wrong names, bad passwords and invalid hashes never verify", () => {
  assert.equal(verifyNativeTestLogin("not-cabo_test", examplePassword, good), false);
  assert.equal(verifyNativeTestLogin("cabo_test", "wrong-test-password", good), false);
  assert.equal(verifyNativeTestLogin("cabo_test", "", good), false);
  assert.equal(verifyNativeTestLogin("cabo_test", {}, good), false);
  assert.equal(verifyNativeTestLogin("cabo_test", examplePassword, { ...good, CABO_TEST_PASSWORD_HASH: "invalid" }), false);
});
test("native test login accepts only validated synthetic principals with their own hash", () => {
  const fixture = { username: "cabo_parent_primary", hash: salt + ":" + hash };
  assert.equal(verifyNativeTestLogin(fixture.username, examplePassword, good, fixture), true);
  assert.equal(verifyNativeTestLogin(fixture.username, "wrong-test-password", good, fixture), false);
  assert.equal(verifyNativeTestLogin("cabo_unknown", examplePassword, good, fixture), false);
  assert.equal(verifyNativeTestLogin(fixture.username, examplePassword, good), false);
  assert.equal(verifyNativeTestLogin(fixture.username, examplePassword,
    { ...good, CABO_TEST_DATABASE_ISOLATED: "false" }, fixture), false);
});
test("test login is invisible in ordinary app builds", () => {
  const ios = readFileSync("native-apps/ios/Info.plist", "utf8");
  const android = readFileSync("native-apps/android/app/build.gradle.kts", "utf8");
  const windows = readFileSync("native-apps/windows/CABO.Native/MainWindow.xaml.cs", "utf8");
  assert.match(ios, /<key>CABO_ENABLE_TEST_LOGIN<\/key><false\/>/);
  assert.match(android, /caboEnableTestLogin/);
  assert.match(android, /origin != publicOrigin/);
  assert.doesNotMatch(windows, /native\/test-login/);
});
test("native sign-out remains available for isolated test sessions", () => {
  const routes = readFileSync("artifacts/api-server/src/routes/nativeAuth.ts", "utf8");
  assert.match(routes, /nativeTestLoginEnabled\(process\.env\)/);
  assert.match(routes, /req\.isAuthenticated\(\)/);
  assert.match(routes, /access_token: "cabo-native-session-v1"/);
  assert.match(routes, /configuredPrincipals\(process\.env\.CABO_TEST_USERS_JSON\)/);
  assert.match(routes, /fixture\.userId/);
});
