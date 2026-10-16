import test from "node:test";
import assert from "node:assert/strict";
import { railwayUploadUrl } from "../lib/railwayUploadUrl.ts";

const objectPath = "/railway-uploads/38e7f9c7-25f9-4a46-ac2d-1b8817d858a0";

test("testing upload URL is absolute, same-origin, and satisfies API response schema", () => {
  const url = railwayUploadUrl("cabo-learner-hub-api-testing.up.railway.app", objectPath);
  assert.equal(url, "https://cabo-learner-hub-api-testing.up.railway.app/api/storage/uploads/railway/38e7f9c7-25f9-4a46-ac2d-1b8817d858a0");
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.host, "cabo-learner-hub-api-testing.up.railway.app");
  assert.equal(parsed.pathname, "/api/storage/uploads/railway/38e7f9c7-25f9-4a46-ac2d-1b8817d858a0");
});

test("rejects unsafe hosts and non-fixture upload paths", () => {
  assert.throws(() => railwayUploadUrl("evil.example/path", objectPath));
  assert.throws(() => railwayUploadUrl("evil.example@elsewhere.invalid", objectPath));
  assert.throws(() => railwayUploadUrl("localhost", "/objects/not-test"));
});
