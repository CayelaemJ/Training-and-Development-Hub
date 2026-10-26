import test from "node:test";
import assert from "node:assert/strict";

// Run ONLY with time-limited, synthetic-user session IDs issued on the separate
// Neon rehearsal branch. Never store session IDs in source, logs or CI secrets
// shared with production. This suite performs GET requests only.
const EXACT_HOST="cabo-za-bw-compliance-synthetic-preview.onrender.com";
const base=process.env.CABO_QA_BASE_URL;
if (!base || !/^https:\/\//.test(base) || new URL(base).host!==EXACT_HOST ||
    new URL(base).pathname!=="/" || process.env.CABO_QA_SYNTHETIC_ONLY!=="true") {
  throw Error("Refusing to run: exact isolated Render QA URL and CABO_QA_SYNTHETIC_ONLY=true required");
}
const cfg={
  A:process.env.CABO_QA_SID_A,
  B:process.env.CABO_QA_SID_B,
  C:process.env.CABO_QA_SID_C,
  guardian:process.env.CABO_QA_SID_GUARDIAN,
  zaOne:Number(process.env.CABO_QA_ORG_ZA_ONE),
  zaTwo:Number(process.env.CABO_QA_ORG_ZA_TWO),
  bwApproved:Number(process.env.CABO_QA_ORG_BW_APPROVED),
  bwRevoked:Number(process.env.CABO_QA_ORG_BW_REVOKED),
};
for(const [key,value] of Object.entries(cfg)){
  if(key==="A"||key==="B"||key==="C"||key==="guardian"){
    if(!/^[a-f0-9]{32,128}$/.test(value??""))throw Error("Missing ephemeral test session "+key);
  }else if(!Number.isSafeInteger(value)||value<=0)throw Error("Missing synthetic school id "+key);
}
const userA="qa-synthetic-learner-a-20261026";
const endpoint = path => new URL("api"+path,base).href;
async function get(user,path){
 const response=await fetch(endpoint(path),{
   method:"GET",headers:{Authorization:"Bearer "+cfg[user],Accept:"application/json"},
   redirect:"error",signal:AbortSignal.timeout(15_000),
 });
 const payload=await response.text();
 let json=null;try{json=JSON.parse(payload)}catch{}
 return {status:response.status,json,cache:response.headers.get("cache-control"),length:payload.length};
}
function minimizedAttendance(result,status,school,day){
 assert.equal(result.status,200);
 assert.equal(result.json?.organizationId,school);
 assert.deepEqual(result.json?.attendance,[{day,status}]);
 assert.match(result.cache??"",/no-store/);
 for(const row of result.json?.attendance??[]){
   assert.equal(Object.hasOwn(row,"note"),false);
   assert.equal(Object.hasOwn(row,"recordedBy"),false);
 }
}
test("ZA enrolment + attendance are scoped to the authenticated learner, not merely the approved school",async()=>{
 const mine=await get("A",`/organizations/${cfg.zaOne}/attendance/me`);
 minimizedAttendance(mine,"present",cfg.zaOne,"2026-10-20");
 minimizedAttendance(await get("B",`/organizations/${cfg.zaOne}/attendance/me`),
   "absent",cfg.zaOne,"2026-10-20");
 const unrelated=await get("C",`/organizations/${cfg.zaOne}/attendance/me`);
 assert.equal(unrelated.status,200);assert.deepEqual(unrelated.json?.attendance,[]);
 const cross=await get("A",`/organizations/${cfg.zaTwo}/attendance/me`);
 assert.equal(cross.status,200);assert.deepEqual(cross.json?.attendance,[]);
});
test("only a learner's own school's enrolments and issued reports appear",async()=>{
 const mine=await get("A",`/organizations/${cfg.zaOne}/institution-records/me`);
 assert.equal(mine.status,200);
 assert.ok(mine.json?.enrollments?.length===1);
 assert.ok(mine.json.enrollments.every(row=>row.organizationId===cfg.zaOne));
 const other=await get("C",`/organizations/${cfg.zaOne}/institution-records/me`);
 assert.deepEqual(other.json?.enrollments,[]);
 const a=await get("A",`/organizations/${cfg.zaOne}/report-issuance/me`);
 const b=await get("B",`/organizations/${cfg.zaOne}/report-issuance/me`);
 const c=await get("C",`/organizations/${cfg.zaTwo}/report-issuance/me`);
 for(const [result,identity] of [[a,"A"],[b,"B"],[c,"C"]]){
   assert.equal(result.status,200);
   assert.equal(result.json?.length,1);
   assert.equal(result.json[0]?.snapshot?.learner,identity);
   assert.equal(result.json[0]?.snapshot?.synthetic,true);
 }
 const noA=await get("A",`/organizations/${cfg.zaTwo}/report-issuance/me`);
 assert.deepEqual(noA.json,[]);
 const foreign=await get("C",`/organizations/${cfg.zaOne}/report-issuance/me`);
 assert.deepEqual(foreign.json,[]);
});
test("report integrity cannot be queried for another learner or another school",async()=>{
 const own=await get("A",`/organizations/${cfg.zaOne}/report-issuance/1/integrity`);
 assert.equal(own.status,200);
 assert.equal(own.json?.issuerIdentityAccredited,false);
 assert.equal((await get("A",`/organizations/${cfg.zaOne}/report-issuance/2/integrity`)).status,403);
 assert.equal((await get("C",`/organizations/${cfg.zaOne}/report-issuance/1/integrity`)).status,403);
});
test("Botswana revoked school blocked, unscoped AI, uploads and transfers denied",async()=>{
 assert.equal((await get("A",`/organizations/${cfg.bwRevoked}/attendance/me`)).status,409);
 assert.equal((await get("A",`/organizations/${cfg.bwApproved}/attendance/me`)).status,200);
 for(const url of ["/institution-records/me","/development-plans/draft",
   `/organizations/${cfg.zaOne}/transfers/incoming`,
   `/organizations/${cfg.zaOne}/transfers/12/decision`]){
   assert.equal((await get("A",url)).status,409,url);
 }
 assert.equal((await get("A","/organizations/invalid/attendance/me")).status,400);
});
test("latest revoked guardian verification denies issued reports",async()=>{
 const guardian=await get("guardian",
   `/guardian/issued-reports/${userA}?organizationId=${cfg.zaOne}`);
 assert.equal(guardian.status,403);
});
