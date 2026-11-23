import assert from "node:assert/strict";
import test from "node:test";
import { learningHubContainerEnv, validateLearningHubCutover } from "./gate.mjs";

const host = "learning.example.test";
const configured = {
  CABO_LEARNING_BACKEND_ENABLED: "true",
  CABO_LEARNING_HOST: host,
  CABO_LEARNING_CONTAINER: { getByName() {} },
  CABO_LEARNING_DATABASE_URL: "postgresql://database.example.test/cabo",
  CABO_LEARNING_OIDC_CLIENT_ID: "test-client",
  CABO_LEARNING_OIDC_ISSUER_URL: "https://identity.example.test/oidc",
  CABO_CHILD_DATA_REVIEW_COMPLETE: "true",
  CABO_MFA_E2E_VERIFIED: "true",
  CABO_TENANT_ISOLATION_E2E_VERIFIED: "true",
  CABO_OIDC_ORIGIN_VERIFIED: "true",
};

test("requires a configured origin and preserves the reviewed cutover gates", () => {
  assert.deepEqual(validateLearningHubCutover(configured, host), { ready: true, failures: [] });
  assert.equal(validateLearningHubCutover(configured, "other.example.test").ready, false);
  for (const flag of [
    "CABO_LEARNING_BACKEND_ENABLED",
    "CABO_CHILD_DATA_REVIEW_COMPLETE",
    "CABO_MFA_E2E_VERIFIED",
    "CABO_TENANT_ISOLATION_E2E_VERIFIED",
    "CABO_OIDC_ORIGIN_VERIFIED",
  ]) {
    assert.equal(validateLearningHubCutover({ ...configured, [flag]: "false" }, host).ready, false, flag);
  }
});

test("rejects missing or invalid identity configuration", () => {
  assert.equal(validateLearningHubCutover({ ...configured, CABO_LEARNING_OIDC_CLIENT_ID: " " }, host).ready, false);
  for (const issuer of [undefined, "", "http://identity.example.test", "https://user:secret@identity.example.test", "https://identity.example.test/#unexpected"]) {
    const result = validateLearningHubCutover({ ...configured, CABO_LEARNING_OIDC_ISSUER_URL: issuer }, host);
    assert.deepEqual(result.failures, ["Invalid OIDC issuer URL"]);
  }
});

test("passes identity configuration and the canonical browser origin to Express", () => {
  const runtime = learningHubContainerEnv(configured);
  assert.equal(runtime.ISSUER_URL, configured.CABO_LEARNING_OIDC_ISSUER_URL);
  assert.equal(runtime.REPL_ID, configured.CABO_LEARNING_OIDC_CLIENT_ID);
  assert.equal(runtime.DATABASE_URL, configured.CABO_LEARNING_DATABASE_URL);
  assert.equal(runtime.CABO_ALLOWED_ORIGINS, `https://${host}`);
  assert.equal(runtime.CABO_NATIVE_AUTH_ENABLED, "true");
  assert.equal(runtime.ENABLE_CABO_DEMO_SEED, "false");

  const unverified = learningHubContainerEnv({
    ...configured,
    CABO_OIDC_ORIGIN_VERIFIED: "false",
    CABO_ALLOWED_ORIGINS: "https://website.example.test",
  });
  assert.equal(unverified.CABO_NATIVE_AUTH_ENABLED, "false");
  assert.equal(unverified.CABO_ALLOWED_ORIGINS, `https://${host},https://website.example.test`);
});
