import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {fileURLToPath,pathToFileURL} from "node:url";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
const require=createRequire(new URL("../../package.json",import.meta.url));
const {build}=require("esbuild");
const dir=await mkdtemp(path.join(tmpdir(),"cabo-preference-policy-"));
after(()=>rm(dir,{recursive:true,force:true}));
const outfile=path.join(dir,"policy.mjs");
await build({entryPoints:[fileURLToPath(new URL("../lib/preferenceConsentPolicy.ts",import.meta.url))],
  platform:"node",format:"esm",bundle:true,outfile,logLevel:"silent"});
const {canConfirmEmailPreference,isPreferenceKindAllowed}=await import(pathToFileURL(outfile).href);
const now=1793268000;
const base={
  accountEmail:"Adult.Example@example.org",verifiedSessionEmail:"adult.example@example.org",
  recentMfa:{source:"oidc",mfaAt:now-60},actor:"verified_guardian",
  kind:"guardian_review_requested",acknowledge:true,nowSeconds:now
};
test("verified guardian can confirm only own explicitly acknowledged notices after recent trusted MFA",()=>{
  assert.equal(canConfirmEmailPreference(base),true);
  for(const patch of [
    {verifiedSessionEmail:undefined},{verifiedSessionEmail:"other@example.org"},
    {recentMfa:{source:"oidc",mfaAt:now-601}},
    {recentMfa:{source:"browser",mfaAt:now}},
    {recentMfa:null},{acknowledge:false},{accountEmail:null},
    {kind:"learner_support_updated"},
  ])assert.equal(canConfirmEmailPreference({...base,...patch}),false,JSON.stringify(patch));
});
test("course-assigned educator may opt into own support notices, never impersonate guardian or child",()=>{
 const teacher={...base,actor:"assigned_educator",kind:"learner_support_updated"};
 assert.equal(canConfirmEmailPreference(teacher),true);
 assert.equal(isPreferenceKindAllowed("assigned_educator","guardian_review_requested"),false);
 assert.equal(isPreferenceKindAllowed("verified_guardian","learner_support_updated"),false);
 assert.equal(canConfirmEmailPreference({...teacher,actor:"verified_guardian"}),false);
});
