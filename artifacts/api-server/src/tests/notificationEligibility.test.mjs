import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {fileURLToPath,pathToFileURL} from "node:url";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
const require=createRequire(new URL("../../package.json",import.meta.url));
const {build}=require("esbuild");
const dir=await mkdtemp(path.join(tmpdir(),"cabo-consent-"));
after(()=>rm(dir,{recursive:true,force:true}));
const outfile=path.join(dir,"eligibility.mjs");
await build({entryPoints:[fileURLToPath(new URL("../lib/notificationEligibility.ts",import.meta.url))],
  platform:"node",format:"esm",bundle:true,outfile,logLevel:"silent"});
const {isNotificationEligible}=await import(pathToFileURL(outfile).href);
const pref={optedIn:true,confirmedAt:new Date("2026-10-29T09:00:00Z"),revokedAt:null};
const guardian={
 kind:"guardian_review_requested",source:{kind:"guardian_relationship",id:32},
 emailMatches:true,preference:pref,activeEnrollment:true,
 verifiedGuardianRelationship:true,latestGuardianDecision:"verified",
};
const learner={
 kind:"learner_support_updated",source:{kind:"support_ticket",id:3},
 emailMatches:true,preference:pref,activeEnrollment:true,
 recipientIsLearner:true,activeCourseEnrollment:true,
};
test("verified guardian requires current school decision, enrolment and explicit opt-in",()=>{
 assert.equal(isNotificationEligible(guardian),true);
 for(const patch of [
   {verifiedGuardianRelationship:false},{latestGuardianDecision:"revoked"},
   {latestGuardianDecision:null},{activeEnrollment:false},
   {preference:null},{preference:{...pref,optedIn:false}},
   {preference:{...pref,revokedAt:new Date()}},
   {preference:{...pref,confirmedAt:null}},
   {preference:{...pref,confirmedAt:new Date("2100-01-01T00:00:00Z")}},
   {emailMatches:false},{source:{kind:"support_ticket",id:32}},
 ]) assert.equal(isNotificationEligible({...guardian,...patch}),false,JSON.stringify(patch));
});
test("teacher must be course-assigned and still a teacher or assessor",()=>{
 const staff={...learner,recipientIsLearner:false,activeCourseEnrollment:false,
   staffMemberRole:"teacher",assignedCourse:true};
 assert.equal(isNotificationEligible(staff),true);
 assert.equal(isNotificationEligible({...staff,staffMemberRole:"assessor"}),true);
 assert.equal(isNotificationEligible({...staff,staffMemberRole:"admin"}),false);
 assert.equal(isNotificationEligible({...staff,assignedCourse:false}),false);
 assert.equal(isNotificationEligible({...staff,activeEnrollment:false}),false);
});
test("learner must still be enrolled in both school and course",()=>{
 assert.equal(isNotificationEligible(learner),true);
 assert.equal(isNotificationEligible({...learner,activeCourseEnrollment:false}),false);
 assert.equal(isNotificationEligible({...learner,activeEnrollment:false}),false);
 assert.equal(isNotificationEligible({...learner,source:{kind:"guardian_relationship",id:3}}),false);
});
test("unknown identity events never inherit guardian or learner permission",()=>{
 const source={...guardian,kind:"account_security"};
 assert.equal(isNotificationEligible(source),false);
 assert.equal(isNotificationEligible({...guardian,source:{kind:"guardian_relationship",id:-1}}),false);
});
