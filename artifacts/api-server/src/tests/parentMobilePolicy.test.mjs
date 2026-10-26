import test from "node:test";
import assert from "node:assert/strict";
import { parentMobileView, approvedNativeParentLearnerIds } from "../lib/parentMobilePolicy.ts";

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


test("native parent name requires matching latest school guardian verification", () => {
  const relation = [{id:9,learnerId:"learner-a",status:"verified"}];
  const enrolled = [{learnerId:"learner-a",organizationId:10}];
  const verified = new Map([["9:10","verified"]]);
  const approved = approvedNativeParentLearnerIds(relation,enrolled,verified);
  assert.equal(approved.has("learner-a"),true);
  assert.equal(parentMobileView(relation[0],approved,names).learnerName,"Naledi");
});
test("verification from an unrelated school never exposes a child identity", () => {
  const relation=[{id:9,learnerId:"learner-a",status:"verified"}];
  const enrolled=[{learnerId:"learner-a",organizationId:10}];
  const latest = new Map([["9:20","verified"]]);
  const approved=approvedNativeParentLearnerIds(relation,enrolled,latest);
  assert.equal(approved.has("learner-a"),false);
  assert.equal(parentMobileView(relation[0],approved,names).learnerName,null);
});
test("revocation or missing latest institutional decision denies name", () => {
  const relation=[{id:9,learnerId:"learner-a",status:"verified"}];
  const enrolled=[{learnerId:"learner-a",organizationId:10}];
  for(const latest of [new Map(),new Map([["9:10","revoked"]])]){
    const approved=approvedNativeParentLearnerIds(relation,enrolled,latest);
    assert.equal(parentMobileView(relation[0],approved,names).verifiedForRead,false);
  }
});
test("verified school review is insufficient without active enrolment and guardian status", () => {
  const reviewed=new Map([["9:10","verified"]]);
  const pending=[{id:9,learnerId:"learner-a",status:"pending"}];
  assert.equal(approvedNativeParentLearnerIds(pending,[{learnerId:"learner-a",organizationId:10}],reviewed).size,0);
  assert.equal(approvedNativeParentLearnerIds([{id:9,learnerId:"learner-a",status:"verified"}],[],reviewed).size,0);
});
