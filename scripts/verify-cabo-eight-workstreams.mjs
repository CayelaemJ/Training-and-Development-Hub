#!/usr/bin/env node
/**
 * CABO 8-workstream read-only smoke check.
 * Requires CABO_TEST_URL, CABO_TEST_USERNAME, CABO_TEST_PASSWORD.
 * Never prints cookies, credentials, personal records or response bodies.
 * Runs only against localhost or the CABO isolated Railway testing domain.
 */
const target=process.env.CABO_TEST_URL??"";
const username=process.env.CABO_TEST_USERNAME??"";
const password=process.env.CABO_TEST_PASSWORD??"";
const origin=new URL(target);
if(!["localhost","127.0.0.1","cabo-learner-hub-api-testing.up.railway.app"].includes(origin.hostname)||!username||!password){
 console.error("Set CABO_TEST_URL (isolated testing only), CABO_TEST_USERNAME and CABO_TEST_PASSWORD");
 process.exit(2);
}
const base=origin.origin;
const login=await fetch(base+"/api/test-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password}),redirect:"manual"});
if(!login.ok){console.error("Authentication failed: "+login.status);process.exit(2)}
const cookie=login.headers.get("set-cookie")?.split(";")[0];
if(!cookie){console.error("Session cookie not issued");process.exit(2)}
const check=async(name,path,expected=[200])=>{
 try {
  const r=await fetch(base+"/api"+path,{headers:{cookie},redirect:"manual",signal:AbortSignal.timeout(12000)});
  const ok=expected.includes(r.status);
  console.log((ok?"PASS":"FAIL")+" "+name+" ("+r.status+")");
  return ok;
 }catch {console.log("FAIL "+name+" (network/timeout)");return false}
};
let failed=0;
const checks=[
 ["1 Identity and authenticated portal","/portal/me",[200]],
 ["2 Academic performance and reports","/report-issuance/me",[200]],
 ["3 Timetable and attendance dashboard","/school/attendance/me",[200]],
 ["4 AI provider configuration","/ai/capabilities",[200]],
 ["5 Assessment bank authorization","/organizations/1/question-bank",[200,403,404]],
 ["6 University discovery","/admissions/institutions",[200]],
 ["7 Educational governance","/education-command/overview?year=2026",[200]],
 ["8 Operations health endpoint","/healthz",[200]]
];
for(const [name,path,expected] of checks)if(!(await check(name,path,expected)))failed++;
await fetch(base+"/api/test-logout",{method:"POST",headers:{cookie},redirect:"manual"}).catch(()=>{});
if(failed){console.error(failed+" workstream smoke checks failed");process.exitCode=1}
else console.log("Eight read-only endpoint checks completed. This does NOT certify end-to-end workflows, roles, POPIA or government integrations.");
