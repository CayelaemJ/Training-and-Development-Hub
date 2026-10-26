import test from "node:test";
import assert from "node:assert/strict";
import {assessSchoolDataRelease,identifyCountryScopedSchoolRoute} from "../lib/schoolDataReleasePolicy.ts";
const now = new Date("2026-10-26T10:00:00.000Z");
const snapshot = {
 countryCode:"ZA",setupStatus:"submitted",approvalCountry:"ZA",approvalState:"approved",
 evidenceReference:"legal-file-reviewed-123",
 approvedAt:new Date("2026-10-24T12:00:00.000Z"),
 expiresAt:new Date("2026-12-24T12:00:00.000Z"),
};
test("only time-bounded same-country signed review state can release school data",()=>{
 assert.deepEqual(assessSchoolDataRelease(snapshot,now),{allowed:true,reason:"approved"});
 for(const countryCode of ["BW",null,""]) assert.equal(assessSchoolDataRelease({...snapshot,countryCode},now).allowed,false);
 assert.equal(assessSchoolDataRelease({...snapshot,approvalCountry:"BW"},now).reason,"country_mismatch");
 assert.equal(assessSchoolDataRelease({...snapshot,setupStatus:"draft"},now).reason,"not_submitted");
 for(const state of ["revoked","blocked",null]) assert.equal(assessSchoolDataRelease({...snapshot,approvalState:state},now).allowed,false);
 assert.equal(assessSchoolDataRelease({...snapshot,evidenceReference:" "},now).reason,"missing_evidence");
 assert.equal(assessSchoolDataRelease({...snapshot,expiresAt:now},now).reason,"expired");
 assert.equal(assessSchoolDataRelease({...snapshot,approvedAt:new Date("2026-11-24T00:00:00Z")},now).reason,"expired");
});
test("Botswana approval cannot be reused for South African school",()=>{
 assert.equal(assessSchoolDataRelease({...snapshot,countryCode:"BW",approvalCountry:"ZA"},now).allowed,false);
 assert.equal(assessSchoolDataRelease({...snapshot,countryCode:"BW",approvalCountry:"BW"},now).allowed,true);
});
test("organisation scoped learner routes require reviewed institution id",()=>{
 assert.deepEqual(identifyCountryScopedSchoolRoute("/organizations/12/academic",undefined),{kind:"scoped",orgId:12});
 assert.deepEqual(identifyCountryScopedSchoolRoute("/organizations/12/support",undefined),{kind:"scoped",orgId:12});
 assert.deepEqual(identifyCountryScopedSchoolRoute("/reports/me","7"),{kind:"scoped",orgId:7});
 assert.deepEqual(identifyCountryScopedSchoolRoute("/guardian/reports/learner1","11"),{kind:"scoped",orgId:11});
 assert.deepEqual(identifyCountryScopedSchoolRoute("/organizations/12/setup",undefined),{kind:"not_scoped"});
 assert.deepEqual(identifyCountryScopedSchoolRoute("/organizations/12/setup/",undefined),{kind:"not_scoped"});
});
test("bad org ids and self-report routes fail closed under strict gating",()=>{
 for(const invalid of ["/organizations/0/academic","/organizations/no/academic","/organizations/999999999999999999999/academic"])
   assert.equal(identifyCountryScopedSchoolRoute(invalid,undefined).kind,"invalid");
 assert.equal(identifyCountryScopedSchoolRoute("/reports/me",undefined).kind,"invalid");
 assert.equal(identifyCountryScopedSchoolRoute("/reports/me",["1","2"]).kind,"invalid");
 for(const sensitive of ["/institution-records/me","/institution-records/transfers",
 "/guardian-relationships","/learner-journey/me","/native/mobile/parent/reports"])
   assert.equal(identifyCountryScopedSchoolRoute(sensitive,null).kind,"unscoped_sensitive");
 assert.equal(identifyCountryScopedSchoolRoute("/health",undefined).kind,"not_scoped");
});
