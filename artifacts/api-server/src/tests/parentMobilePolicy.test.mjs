import test from "node:test";
import assert from "node:assert/strict";
import { parentMobileView } from "../lib/parentMobilePolicy.ts";

const active = new Set(["learner-a"]);
const names = new Map([["learner-a", "Naledi"]]);

test("no child name or learner ID for unverified parent requests", () => {
  for (const status of ["pending","accepted","declined","revoked"]) {
    const result = parentMobileView({ id: 4, learnerId:"learner-a", status }, active, names);
    assert.equal(result.learnerName, null);
    assert.equal(result.verifiedForRead, false);
    assert.equal("learnerId" in result, false);
    assert.equal(JSON.stringify(result).includes("learner-a"),false);
  }
});

test("verification alone is insufficient when school enrollment isn't active", () => {
  const result = parentMobileView({ id: 5, learnerId:"learner-b", status:"verified" }, active, names);
  assert.equal(result.learnerName,null);
  assert.equal(result.verifiedForRead,false);
});

test("only verified + active connection receives learner's first name", () => {
  const result = parentMobileView({ id: 9, learnerId:"learner-a", status:"verified" }, active, names);
  assert.deepEqual(result, {
    invitationId:9, status:"verified", learnerName:"Naledi", verifiedForRead:true
  });
});
