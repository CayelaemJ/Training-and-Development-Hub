import test from "node:test";
import assert from "node:assert/strict";
import { assessAdmissionHandoff, minimalAdmissionReceipt, canPurgeTemporaryEvidence, assessAcademicTransfer, planModules } from "../lib/admissionsTrustPolicy.ts";
const approved={
 stage:"primary", adultStatus:"verified_minor", country:"ZA", institutionApprovedForIntake:true,
 institutionCountryCleared:true, receivingInstitutionAuthorized:true, applicantDisclosureApproved:true,
 guardian:{legallyVerified:true,active:true,purposeSpecificConsent:true,consentExpiresAt:new Date("2027-01-01T00:00:00Z")},
 requiredDocuments:"cleared", qualificationAuthenticity:"not_required", fees:"settled"
};
const now=new Date("2026-10-27T09:00:00Z");
test("all preprimary, primary and high school admissions block missing guardians",()=>{
 for(const stage of ["preprimary","primary","secondary"]){
  for(const adultStatus of ["verified_adult","verified_minor","unknown"]){
   const result=assessAdmissionHandoff({...approved,stage,adultStatus,guardian:null},now);
   assert.equal(result.code,0);
   assert.ok(result.blockers.includes("verified_guardian_and_current_consent_required"));
  }
 }
});
test("revoked and expired guardian permissions block submission",()=>{
 assert.equal(assessAdmissionHandoff({...approved,guardian:{...approved.guardian,active:false}},now).code,0);
 assert.equal(assessAdmissionHandoff({...approved,guardian:{...approved.guardian,consentExpiresAt:now}},now).code,0);
 assert.equal(assessAdmissionHandoff({...approved,guardian:{...approved.guardian,purposeSpecificConsent:false}},now).code,0);
});
test("unknown tertiary adult status blocks and minor tertiary applications require guardians",()=>{
 assert.equal(assessAdmissionHandoff({...approved,stage:"undergraduate",adultStatus:"unknown",guardian:null},now).code,0);
 assert.equal(assessAdmissionHandoff({...approved,stage:"undergraduate",adultStatus:"verified_minor",guardian:null},now).code,0);
 assert.equal(assessAdmissionHandoff({...approved,stage:"undergraduate",adultStatus:"verified_adult",guardian:null},now).code,1);
});
test("no client claimed payment or AI guess can clear institution and qualification gates",()=>{
 for(const patch of [{fees:"unverified"},{requiredDocuments:"pending"},{qualificationAuthenticity:"pending"},{institutionCountryCleared:false},{receivingInstitutionAuthorized:false},{applicantDisclosureApproved:false}]) {
  assert.equal(assessAdmissionHandoff({...approved,...patch},now).code,0);
 }
});
test("minimal receipt contains no guardian or document details",()=>{
 const receipt=minimalAdmissionReceipt(assessAdmissionHandoff(approved,now));
 assert.deepEqual(receipt,{verified:1});
 assert.equal(JSON.stringify(receipt).includes("guardian"),false);
});
test("temporary evidence purges only after verification, delivery and legal-hold review",()=>{
 const input={verificationFinal:true,requiredForOpenReview:false,applicableRetentionOrLegalHold:false,institutionHasAcceptedNecessaryRecords:true};
 assert.equal(canPurgeTemporaryEvidence(input),true);
 for(const patch of [{verificationFinal:false},{requiredForOpenReview:true},{applicableRetentionOrLegalHold:true},{institutionHasAcceptedNecessaryRecords:false}])
  assert.equal(canPurgeTemporaryEvidence({...input,...patch}),false);
});
test("transfers require both institutions, consent, official records and country clearance",()=>{
 const input={sourceAuthorized:true,destinationAuthorized:true,learnerOrVerifiedGuardianConsented:true,purposeLimitedScopeApproved:true,countryTransferCleared:true,officialTranscriptValidated:true,unresolvedDisputeOrHold:false};
 assert.equal(assessAcademicTransfer(input).readyForHumanReview,true);
 for(const patch of [{sourceAuthorized:false},{destinationAuthorized:false},{learnerOrVerifiedGuardianConsented:false},{purposeLimitedScopeApproved:false},{countryTransferCleared:false},{officialTranscriptValidated:false},{unresolvedDisputeOrHold:true}]) {
  assert.equal(assessAcademicTransfer({...input,...patch}).readyForHumanReview,false);
 }
});
test("module advice sums approved credits but cannot submit or grant double majors",()=>{
 const modules=[{code:"ACC101",credits:12,prerequisiteCodes:[],majorCode:"ACC"},{code:"ACC201",credits:16,prerequisiteCodes:["ACC101"],majorCode:"ACC"}];
 const input={catalogueConfirmed:true,modules,selectedCodes:["ACC201"],completedCodes:[],creditLimit:60,doubleMajorRequested:true,doubleMajorApprovedByAdvisor:false};
 const result=planModules(input);
 assert.equal(result.credits,16);
 assert.equal(result.eligibleForSubmission,false);
 assert.deepEqual(result.missingPrerequisites,["ACC201:ACC101"]);
 assert.ok(result.issues.includes("double_major_advisor_approval_required"));
 assert.ok(result.issues.includes("prerequisites_unmet"));
 assert.ok(planModules({...input,selectedCodes:["ACC101","ACC101"]}).issues.includes("duplicate_selection"));
});
