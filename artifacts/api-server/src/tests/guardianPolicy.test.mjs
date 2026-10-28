import test from "node:test";
import assert from "node:assert/strict";
import {canVerifyGuardian,canRevokeGuardian,canReadChildReport} from "../lib/guardianPolicy.ts";
test("pending, declined, and accepted guardian links never expose child reports",()=>{
 for(const status of ["pending","accepted","declined","revoked"]){
  assert.equal(canReadChildReport(status,true,true),false);
 }
});
test("verification requires acceptance, reviewed evidence and active enrolment",()=>{
 assert.equal(canVerifyGuardian("accepted",true,true),true);
 assert.equal(canVerifyGuardian("pending",true,true),false);
 assert.equal(canVerifyGuardian("accepted",false,true),false);
 assert.equal(canVerifyGuardian("accepted",true,false),false);
});
test("approved guardian access requires institution audit and active enrolment",()=>{
 assert.equal(canReadChildReport("verified",true,true),true);
 assert.equal(canReadChildReport("verified",false,true),false);
 assert.equal(canReadChildReport("verified",true,false),false);
 assert.equal(canRevokeGuardian("verified",true),true);
 assert.equal(canRevokeGuardian("accepted",true),false);
});
