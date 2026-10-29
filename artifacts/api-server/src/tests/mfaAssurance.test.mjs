import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {fileURLToPath,pathToFileURL} from "node:url";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
const require=createRequire(new URL("../../package.json",import.meta.url));
const {build}=require("esbuild");
const dir=await mkdtemp(path.join(tmpdir(),"cabo-mfa-"));
after(()=>rm(dir,{recursive:true,force:true}));
const outfile=path.join(dir,"mfa.mjs");
await build({entryPoints:[fileURLToPath(new URL("../lib/mfaAssurance.ts",import.meta.url))],
  bundle:true,platform:"node",format:"esm",outfile,logLevel:"silent"});
const {trustedMfaFromOidcClaims,isRecentVerifiedMfa,isPrivilegedMutation,privilegedPortalRoles}=
 await import(pathToFileURL(outfile).href);
const now=1793268000;

test("accepts validated MFA claim with recent auth time only",()=>{
 const a=trustedMfaFromOidcClaims({sub:"test",amr:["pwd","mfa"],auth_time:now-90},now);
 assert.deepEqual(a,{source:"oidc",mfaAt:now-90});
 assert.equal(isRecentVerifiedMfa(a,now),true);
 assert.equal(isRecentVerifiedMfa(a,now+601),false);
});
test("rejects single factor, absent and malformed claims",()=>{
 for(const claims of [
  {amr:["pwd"],auth_time:now},
  {amr:["otp"],auth_time:now},
  {amr:["sms","pwd"],auth_time:now},
  {amr:"mfa",auth_time:now},
  {amr:["mfa"],auth_time:"1793268000"},
  {amr:["mfa"],auth_time:now+180},
  {amr:["mfa"]},
  {auth_time:now}
 ])assert.equal(trustedMfaFromOidcClaims(claims,now),undefined);
});
test("untrusted session flags or stale/future auth cannot impersonate MFA",()=>{
 assert.equal(isRecentVerifiedMfa({mfa:true,mfaAt:now},now),false);
 assert.equal(isRecentVerifiedMfa({source:"browser",mfaAt:now},now),false);
 assert.equal(isRecentVerifiedMfa({source:"oidc",mfaAt:now-601},now),false);
 assert.equal(isRecentVerifiedMfa({source:"oidc",mfaAt:now+120},now),false);
 assert.equal(isRecentVerifiedMfa(null,now),false);
});
test("privileged action classification includes platform reads and admin mutations",()=>{
 assert.equal(isPrivilegedMutation("POST","/api/organizations/3/members"),true);
 assert.equal(isPrivilegedMutation("PATCH","/api/organizations/3?token=secret"),true);
 assert.equal(isPrivilegedMutation("GET","/api/platform/audit"),true);
 assert.equal(isPrivilegedMutation("POST","/api/logout"),false);
 assert.equal(isPrivilegedMutation("POST","/api/native/token"),false);
 assert.equal(isPrivilegedMutation("GET","/api/portal/me"),false);
 assert.equal(privilegedPortalRoles.has("superadmin"),true);
 assert.equal(privilegedPortalRoles.has("headmaster"),true);
 assert.equal(privilegedPortalRoles.has("learner"),false);
});
