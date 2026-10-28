import test from "node:test";
import assert from "node:assert/strict";
import {COUNTRIES,assessInstitutionProfileSubmission,countryChangeNeedsReview} from "../lib/countryCompliancePolicy.ts";

test("South Africa and Botswana law profiles are distinct",()=>{
 assert.equal(COUNTRIES.ZA.name,"South Africa");
 assert.equal(COUNTRIES.BW.name,"Botswana");
 assert.match(COUNTRIES.BW.law,/2024/);
});
test("both countries can plan synthetic-only draft school profiles",()=>{
 for(const country of ["ZA","BW",null]){
  assert.deepEqual(assessInstitutionProfileSubmission(country,"draft",{}),
   {allowed:true,missing:[],legalCertification:false});
 }
});
test("unclassified legacy school cannot submit an institution profile",()=>{
 const decision=assessInstitutionProfileSubmission(null,"submitted",{});
 assert.equal(decision.allowed,false);
 assert.deepEqual(decision.missing,["COUNTRY_CLASSIFICATION_REQUIRED"]);
});
test("Botswana school submission fails closed without local transfer copy evidence",()=>{
 const settings={
  CABO_BW_INSTITUTION_AUTHORITY_REVIEWED:"true",
  CABO_BW_CHILD_DATA_LAWFUL_BASIS_REVIEWED:"true",
  CABO_BW_CROSS_BORDER_TRANSFERS_REVIEWED:"true"
 };
 let result=assessInstitutionProfileSubmission("BW","submitted",settings);
 assert.equal(result.allowed,false);
 assert.ok(result.missing.includes("CABO_BW_LOCAL_TRANSFER_COPY_VERIFIED"));
 result=assessInstitutionProfileSubmission("BW","submitted",{...settings,CABO_BW_LOCAL_TRANSFER_COPY_VERIFIED:"true"});
 assert.equal(result.allowed,true);
 assert.equal(result.legalCertification,false);
});
test("South African setup requires jurisdiction-specific attestations, not Botswana settings",()=>{
 const bw={
  CABO_BW_INSTITUTION_AUTHORITY_REVIEWED:"true",
  CABO_BW_CHILD_DATA_LAWFUL_BASIS_REVIEWED:"true",
  CABO_BW_CROSS_BORDER_TRANSFERS_REVIEWED:"true",
  CABO_BW_LOCAL_TRANSFER_COPY_VERIFIED:"true"
 };
 const decision=assessInstitutionProfileSubmission("ZA","submitted",bw);
 assert.equal(decision.allowed,false);
 assert.equal(decision.missing.length,3);
});
test("existing country classification cannot silently be switched",()=>{
 assert.equal(countryChangeNeedsReview("ZA","BW"),true);
 assert.equal(countryChangeNeedsReview("BW",null),true);
 assert.equal(countryChangeNeedsReview("BW","BW"),false);
 assert.equal(countryChangeNeedsReview(null,"BW"),false);
});
test("near-miss approval values do not count as affirmative evidence",()=>{
 const decision=assessInstitutionProfileSubmission("BW","submitted",{
  CABO_BW_INSTITUTION_AUTHORITY_REVIEWED:"TRUE",
  CABO_BW_CHILD_DATA_LAWFUL_BASIS_REVIEWED:"1",
  CABO_BW_CROSS_BORDER_TRANSFERS_REVIEWED:"yes",
  CABO_BW_LOCAL_TRANSFER_COPY_VERIFIED:"false"
 });
 assert.equal(decision.allowed,false);
 assert.equal(decision.missing.length,4);
});
