import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  learnerGuardianInvitesEnabled, learnerTransferRequestsEnabled, uniformGuardianRequestResponse,
} from "../lib/learnerInitiatedRequestPolicy.ts";

const routes = readFileSync(new URL("../routes/institutionRecords.ts", import.meta.url), "utf8");
function handler(method, path) {
  const start = routes.indexOf(`router.${method}("${path}"`);
  assert.ok(start >= 0, `${path} must exist`);
  const next = routes.indexOf("\nrouter.", start + 1);
  return routes.slice(start, next < 0 ? undefined : next);
}

test("learner-initiated guardian invites and transfers are off unless explicitly enabled", () => {
  for (const env of [{}, { ENABLE_LEARNER_GUARDIAN_INVITES: "1" }, { ENABLE_LEARNER_GUARDIAN_INVITES: "TRUE" },
    { ENABLE_LEARNER_GUARDIAN_INVITES: " true" }]) {
    assert.equal(learnerGuardianInvitesEnabled(env), false, JSON.stringify(env));
  }
  assert.equal(learnerGuardianInvitesEnabled({ ENABLE_LEARNER_GUARDIAN_INVITES: "true" }), true);
  assert.equal(learnerTransferRequestsEnabled({}), false);
  assert.equal(learnerTransferRequestsEnabled({ ENABLE_LEARNER_GUARDIAN_INVITES: "true" }), false, "flags are independent");
  assert.equal(learnerTransferRequestsEnabled({ ENABLE_LEARNER_TRANSFER_REQUESTS: "true" }), true);
});

test("both routes check their gate before authentication or any lookup", () => {
  const guardian = handler("post", "/guardian-relationships");
  const transfer = handler("post", "/institution-records/transfers");
  const before = (src, gate, later) => {
    const g = src.indexOf(gate), l = src.indexOf(later);
    assert.ok(g >= 0, `${gate} must be present`);
    assert.ok(l >= 0 && g < l, `${gate} must run before ${later}`);
  };
  before(guardian, "learnerGuardianInvitesEnabled(process.env)", "current(req,res)");
  before(guardian, "learnerGuardianInvitesEnabled(process.env)", "usersTable");
  before(transfer, "learnerTransferRequestsEnabled(process.env)", "current(req,res)");
  before(transfer, "learnerTransferRequestsEnabled(process.env)", "organizationsTable");
});

test("an enabled guardian request answers identically for unknown, self and duplicate emails", () => {
  const guardian = handler("post", "/guardian-relationships");
  assert.doesNotMatch(guardian, /Provide an existing different account/);
  assert.doesNotMatch(guardian, /Already requested/);
  assert.doesNotMatch(guardian, /status\(201\)/);
  assert.match(guardian, /status\(202\)\.json\(uniformGuardianRequestResponse\(\)\)/);
  const body = uniformGuardianRequestResponse();
  assert.deepEqual(Object.keys(body).sort(), ["message", "status"]);
  assert.doesNotMatch(JSON.stringify(body), /"id"|guardianId|userId/);
});

test("guardian decisions and incoming lists remain available to invited guardians", () => {
  handler("get", "/guardian-relationships/incoming");
  const decide = handler("post", "/guardian-relationships/:id/decision");
  assert.doesNotMatch(decide, /learnerGuardianInvitesEnabled/);
});
