import test from "node:test";
import assert from "node:assert/strict";
import { approvedNativeParentLearnerIds, parentMobileView } from "../lib/parentMobilePolicy.ts";

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

test("native parent name requires the latest approval for an active school", () => {
  const relationships = [{ id: 9, learnerId: "learner-a", status: "verified" }];
  const enrollments = [{ learnerId: "learner-a", organizationId: 10 }];
  const latest = new Map([["9:10", "verified"]]);
  const approved = approvedNativeParentLearnerIds(relationships, enrollments, latest);
  assert.deepEqual([...approved], ["learner-a"]);
  assert.equal(parentMobileView(relationships[0], approved, names).learnerName, "Naledi");
});

test("unrelated school approval never exposes a learner name", () => {
  const relationships = [{ id: 9, learnerId: "learner-a", status: "verified" }];
  const enrollments = [{ learnerId: "learner-a", organizationId: 10 }];
  const latest = new Map([["9:20", "verified"]]);
  const approved = approvedNativeParentLearnerIds(relationships, enrollments, latest);
  assert.equal(parentMobileView(relationships[0], approved, names).learnerName, null);
});

test("missing or revoked latest school approval fails closed", () => {
  const relationships = [{ id: 9, learnerId: "learner-a", status: "verified" }];
  const enrollments = [{ learnerId: "learner-a", organizationId: 10 }];
  for (const latest of [new Map(), new Map([["9:10", "revoked"]])]) {
    const approved = approvedNativeParentLearnerIds(relationships, enrollments, latest);
    const view = parentMobileView(relationships[0], approved, names);
    assert.equal(view.learnerName, null);
    assert.equal(view.verifiedForRead, false);
  }
});

test("school review alone is insufficient without verified guardian and active enrollment", () => {
  const latest = new Map([["9:10", "verified"]]);
  const pending = [{ id: 9, learnerId: "learner-a", status: "pending" }];
  const verified = [{ id: 9, learnerId: "learner-a", status: "verified" }];
  assert.equal(approvedNativeParentLearnerIds(pending, [{ learnerId: "learner-a", organizationId: 10 }], latest).size, 0);
  assert.equal(approvedNativeParentLearnerIds(verified, [], latest).size, 0);
});
