import test from "node:test";
import assert from "node:assert/strict";
import { employerPilotEnabled, validDecision, canReadGrant, disclosedEvidenceCategories } from "../lib/consentPolicy.ts";
test("employer access is off unless explicitly enabled",()=>{
 assert.equal(employerPilotEnabled({}),false);
 assert.equal(employerPilotEnabled({ENABLE_EMPLOYER_ACCESS_PILOT:"false"}),false);
 assert.equal(employerPilotEnabled({ENABLE_EMPLOYER_ACCESS_PILOT:"TRUE"}),false);
 assert.equal(employerPilotEnabled({ENABLE_EMPLOYER_ACCESS_PILOT:"true"}),true);
});
test("only valid subject decisions are accepted",()=>{
 assert.equal(validDecision("pending","approved"),true);
 assert.equal(validDecision("pending","denied"),true);
 assert.equal(validDecision("pending","revoked"),false);
 assert.equal(validDecision("approved","revoked"),true);
 assert.equal(validDecision("approved","approved"),false);
 assert.equal(validDecision("denied","approved"),false);
 assert.equal(validDecision("revoked","approved"),false);
});
test("read requires approval and future expiry",()=>{
 const now=new Date("2026-10-08T00:00:00Z");
 assert.equal(canReadGrant("approved",new Date("2026-10-09T00:00:00Z"),now),true);
 assert.equal(canReadGrant("approved",new Date("2026-10-08T00:00:00Z"),now),false);
 assert.equal(canReadGrant("pending",new Date("2026-10-09T00:00:00Z"),now),false);
 assert.equal(canReadGrant("revoked",new Date("2026-10-09T00:00:00Z"),now),false);
 assert.equal(canReadGrant("approved",null,now),false);
});
test("private childhood data and reflections are never in allowed categories",()=>{
 for(const scope of ["professional","portfolio"]){
  const allowed=disclosedEvidenceCategories(scope);
  assert.equal(allowed.includes("reflection"),false);
  assert.equal(allowed.includes("growth_area"),false);
  assert.equal(allowed.includes("school_marks"),false);
 }
});
