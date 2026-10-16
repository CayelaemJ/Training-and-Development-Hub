import test from "node:test";
import assert from "node:assert/strict";
import {hubKinds,canCreateHubRecord,mayViewHubRecord} from "../lib/hubPolicy.ts";
test("twelve education modules are registered",()=>{assert.equal(hubKinds.length,12);assert.equal(new Set(hubKinds).size,12)});
test("only institution managers may create ordinary records",()=>{
 assert.equal(canCreateHubRecord("teacher","timetable",null),false);
 assert.equal(canCreateHubRecord("owner","timetable",null),true);
 assert.equal(canCreateHubRecord("admin","bursary",null),true);
 assert.equal(canCreateHubRecord("owner","credential","learner"),false);
 assert.equal(canCreateHubRecord("owner","assessment_blueprint",null),false);
 assert.equal(canCreateHubRecord("admin","family_meeting",null),false);
 assert.equal(canCreateHubRecord("admin","family_meeting","learner"),true);
});
test("individual records never leak to other learners or unauthorised staff",()=>{
 for(const k of ["academic_intervention","family_meeting","talent_skill","credential"]){
  assert.equal(mayViewHubRecord("learner",k,"learner-1","learner-2"),false,k);
  assert.equal(mayViewHubRecord("teacher",k,"teacher-1","learner-2"),false,k);
  assert.equal(mayViewHubRecord("learner",k,"learner-1","learner-1"),true,k);
  assert.equal(mayViewHubRecord("learner",k,"learner-1",null),false,k);
 }
});
test("governance and integration records are restricted to managers",()=>{
 assert.equal(mayViewHubRecord("learner","governance_action","learner",null),false);
 assert.equal(mayViewHubRecord("teacher","education_integration","teacher",null),false);
 assert.equal(mayViewHubRecord("owner","education_integration","owner",null),true);
});
