// Synthetic API/database acceptance for the private lifelong passport.
// Uses the same route and Drizzle schema as the application, with PGlite.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import passportRouter from "../../routes/lifelongPassport";
import trustRouter from "../../routes/passportTrustRoutes";
import { engine } from "./supportTestDb";

await engine.exec("CREATE TABLE users(id varchar PRIMARY KEY)");
await engine.exec("CREATE TABLE organizations(id integer PRIMARY KEY,name varchar,owner_id varchar REFERENCES users(id)); CREATE TABLE organization_members(organization_id integer REFERENCES organizations(id),user_id varchar REFERENCES users(id),role varchar,PRIMARY KEY(organization_id,user_id));");
const migration=await readFile("lib/db/migrations/20261022_lifelong_passport_foundation.sql","utf8");
await engine.exec(migration);
await engine.exec(migration); // schema replay must remain safe
const trustMigration=await readFile("lib/db/migrations/20261022_passport_trust_layers.sql","utf8");
await engine.exec(trustMigration);
await engine.exec(trustMigration);
await engine.exec("INSERT INTO users(id) VALUES ('adult-a'),('learner-b'),('assessor-x'),('teacher-x'),('outside-x'),('assessor-y')");
await engine.exec("INSERT INTO organizations(id,name,owner_id) VALUES(1,'Example Learning Institution','assessor-x'),(2,'Other Institution','assessor-y'); INSERT INTO organization_members(organization_id,user_id,role) VALUES (1,'adult-a','learner'),(1,'assessor-x','assessor'),(1,'teacher-x','teacher'),(2,'learner-b','learner'),(2,'assessor-y','assessor');");

const app=express();
app.use(express.json());
app.use((req,_res,next)=>{
 req.user=req.headers["x-test-user"]?({id:String(req.headers["x-test-user"])} as any):undefined;
 req.isAuthenticated=(()=>!!req.user) as any;
 next();
});
app.use("/api",passportRouter,trustRouter);
const server=app.listen(0,"127.0.0.1");
await new Promise<void>(resolve=>server.once("listening",resolve));
const base="http://127.0.0.1:"+(server.address() as {port:number}).port+"/api";
async function call(user:string,route:string,method="GET",body?:unknown){
 const response=await fetch(base+route,{method,headers:{
  "x-test-user":user,"Content-Type":"application/json"
 },...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const data: any = await response.json().catch(()=>null);
 return {status:response.status,data,cacheControl:response.headers.get("cache-control")};
}
try{
 assert.equal((await call("","/learning-passport/me")).status,401);
 assert.equal((await call("","/learning-passport/links","POST",{})).status,401);
 const initial=await call("adult-a","/learning-passport/me");
 assert.equal(initial.status,200);
 assert.match(initial.cacheControl??"",/no-store/);
 assert.deepEqual(initial.data.links,[]);
 assert.deepEqual(initial.data.competencies,[]);
 assert.equal(initial.data.masteryExplanations.length,5);

 const saved=await call("adult-a","/learning-passport/preferences","PUT",{
  learningContext:"adult_returning",preferredLanguage:"isiZulu",learningGoal:"Complete matric while recognising practical skills"
 });
 assert.equal(saved.status,200,JSON.stringify(saved.data));
 assert.equal((await call("adult-a","/learning-passport/me")).data.preferences.learningContext,"adult_returning");
 assert.equal((await call("learner-b","/learning-passport/me")).data.preferences.learningContext,"lifelong");
 assert.equal((await call("adult-a","/learning-passport/preferences","PUT",{
  learningContext:"not_a_real_context",preferredLanguage:"",learningGoal:""
 })).status,400);

 const github={provider:"GitHub",url:"https://github.com/example/project",description:"I built and tested my own application",evidenceType:"project"};
 const createdLink=await call("adult-a","/learning-passport/links","POST",github);
 assert.equal(createdLink.status,201,JSON.stringify(createdLink.data));
 assert.equal(createdLink.data.verificationStatus,"self_reported");
 assert.equal(createdLink.data.visibility,"private");
 assert.equal((await call("adult-a","/learning-passport/links","POST",github)).status,409);
 assert.equal((await call("adult-a","/learning-passport/links","POST",{...github,url:"http://127.0.0.1/private"})).status,400);
 // Ignore client attempts to set disclosure and verification statuses.
 const bLink=await call("learner-b","/learning-passport/links","POST",{
  ...github,url:"https://example.com/circuit",visibility:"public",verificationStatus:"verified"
 });
 assert.equal(bLink.status,201);
 assert.equal(bLink.data.visibility,"private");
 assert.equal(bLink.data.verificationStatus,"self_reported");

 const skill={skill:"Practical circuit construction",category:"technical",masteryLevel:3,demonstration:"practical",
  description:"I assembled and explained a working circuit independently",evidenceLinkId:createdLink.data.id};
 assert.equal((await call("learner-b","/learning-passport/competencies","POST",skill)).status,400,
  "Cross-owner evidence must not be accepted");
 assert.equal((await call("adult-a","/learning-passport/competencies","POST",{...skill,masteryLevel:9})).status,400);
 const createdSkill=await call("adult-a","/learning-passport/competencies","POST",skill);
 assert.equal(createdSkill.status,201,JSON.stringify(createdSkill.data));
 assert.equal(createdSkill.data.verificationStatus,"self_reported");
 assert.equal(createdSkill.data.masteryLevel,3);
 const selfReported=await call("learner-b","/learning-passport/competencies","POST",{
  ...skill,masteryLevel:0,evidenceLinkId:bLink.data.id
 });
 assert.equal(selfReported.status,201);
 const other=await call("learner-b","/learning-passport/me");
 assert.equal(other.data.links.length,1);
 assert.equal(other.data.competencies.length,1);
 assert.equal(other.data.links[0].userId,"learner-b");
 assert.equal((await call("learner-b","/learning-passport/competencies/"+createdSkill.data.id,"DELETE")).status,404);
 assert.equal((await call("learner-b","/learning-passport/links/"+createdLink.data.id,"DELETE")).status,404);
 const own=await call("adult-a","/learning-passport/me");
 assert.equal(own.data.links.length,1);
 assert.equal(own.data.competencies.length,1);
 assert.equal(own.data.competencies[0].evidenceLinkId,createdLink.data.id);
 assert.equal((await call("adult-a","/learning-passport/links/"+createdLink.data.id,"DELETE")).status,204);
 const afterRemove=await call("adult-a","/learning-passport/me");
 assert.equal(afterRemove.data.links.length,0);
 assert.equal(afterRemove.data.competencies.length,1);
 assert.equal(afterRemove.data.competencies[0].evidenceLinkId,null);
 assert.equal((await call("adult-a","/learning-passport/competencies/"+createdSkill.data.id,"DELETE")).status,204);
 assert.equal((await call("adult-a","/learning-passport/me")).data.competencies.length,0);
 assert.equal((await call("learner-b","/learning-passport/me")).data.competencies.length,1);
 
 // Distinct layer 2: the server, never a client-submitted verification, authors AI reflections.
 const none=await call("adult-a","/learning-passport/trust-layers/me");
 assert.equal(none.status,200);
 assert.match(none.cacheControl??"",/no-store/);
 assert.deepEqual(none.data.aiInterpretations,[]);
 assert.deepEqual(none.data.achievementReviews,[]);
 assert.equal((await call("learner-b","/learning-passport/competencies/"+selfReported.data.id+"/interpret","POST")).status,201);
 assert.equal((await call("adult-a","/learning-passport/competencies/"+selfReported.data.id+"/interpret","POST")).status,404);
 const ai=(await call("learner-b","/learning-passport/trust-layers/me")).data.aiInterpretations;
 assert.equal(ai.length,1);
 assert.equal(ai[0].layer,"ai_interpretation");
 assert.equal(ai[0].reviewState,"unreviewed");
 assert.equal(ai[0].modelId,"synthetic-test-model");
 assert.match(ai[0].disclosure,/not evidence/i);
 assert.equal((await call("learner-b","/learning-passport/competencies/"+selfReported.data.id+"/interpret","POST")).status,200);
 assert.equal((await call("adult-a","/learning-passport/interpretations/"+ai[0].id+"/review","PATCH",{reviewState:"noted"})).status,404);
 assert.equal((await call("learner-b","/learning-passport/interpretations/"+ai[0].id+"/review","PATCH",{reviewState:"verified"})).status,400);
 assert.equal((await call("learner-b","/learning-passport/interpretations/"+ai[0].id+"/review","PATCH",{reviewState:"disputed"})).status,200);
 assert.equal((await call("learner-b","/learning-passport/trust-layers/me")).data.aiInterpretations[0].reviewState,"disputed");

 // Distinct layer 3: a learner submits only a named practical item to one institution.
 assert.equal((await call("","/learning-passport/achievements/requests","POST",{})).status,401);
 assert.equal((await call("learner-b","/learning-passport/achievements/requests","POST",
 {organizationId:1,competencyId:selfReported.data.id})).status,403);
 assert.equal((await call("adult-a","/learning-passport/achievements/requests","POST",
 {organizationId:1,competencyId:selfReported.data.id})).status,404);
 const request=await call("learner-b","/learning-passport/achievements/requests","POST",
 {organizationId:2,competencyId:selfReported.data.id,status:"verified",reviewerId:"learner-b"});
 assert.equal(request.status,201,JSON.stringify(request.data));
 assert.equal(request.data.status,"pending");
 assert.equal(request.data.reviewerId,null);
 assert.equal((await call("learner-b","/learning-passport/achievements/requests","POST",
 {organizationId:2,competencyId:selfReported.data.id})).status,409);

 assert.equal((await call("learner-b","/organizations/2/passport/reviews")).status,403);
 assert.equal((await call("outside-x","/organizations/2/passport/reviews")).status,403);
 assert.equal((await call("assessor-x","/organizations/2/passport/reviews")).status,403);
 assert.equal((await call("assessor-x","/organizations/2/passport/reviews/"+request.data.id+"/decision","POST",
 {decision:"verified",reviewNote:"I separately evaluated the learner's practical example."})).status,403);
 const queue=await call("assessor-y","/organizations/2/passport/reviews");
 assert.equal(queue.status,200);
 assert.equal(queue.data.length,1);
 assert.equal(queue.data[0].userId,"learner-b");
 assert.equal(queue.data[0].skill,"Practical circuit construction");
 assert.equal(queue.data[0].learningGoal,undefined);
 assert.equal((await call("assessor-y","/organizations/2/passport/reviews/"+request.data.id+"/decision","POST",
 {decision:"verified",reviewNote:"Too short"})).status,400);
 const approved=await call("assessor-y","/organizations/2/passport/reviews/"+request.data.id+"/decision","POST",
 {decision:"verified",reviewNote:"I reviewed the evidence and observed the practical demonstration in person."});
 assert.equal(approved.status,200,JSON.stringify(approved.data));
 assert.equal(approved.data.status,"verified");
 assert.equal(approved.data.reviewerId,"assessor-y");
 assert.equal(approved.data.qualificationAccreditation,false);
 assert.equal((await call("learner-b","/learning-passport/trust-layers/me")).data.achievementReviews[0].status,"verified");
 assert.equal((await call("learner-b","/learning-passport/trust-layers/me")).data.aiInterpretations[0].reviewState,"disputed");
 assert.equal((await call("assessor-y","/organizations/2/passport/reviews/"+request.data.id+"/decision","POST",
 {decision:"verified",reviewNote:"Attempting duplicate verification is not allowed."})).status,409);
 assert.equal((await call("adult-a","/learning-passport/achievements/"+request.data.id+"/withdraw","POST")).status,409);
 const withdrawn=await call("learner-b","/learning-passport/achievements/"+request.data.id+"/withdraw","POST");
 assert.equal(withdrawn.status,200);
 assert.equal(withdrawn.data.status,"revoked");
 assert.equal((await call("learner-b","/learning-passport/trust-layers/me")).data.achievementReviews[0].status,"revoked");
 const audit=await engine.query("SELECT action,actor_id FROM passport_achievement_audit ORDER BY id");
 assert.deepEqual(audit.rows.map((x:any)=>x.action),["requested","verified","revoked"]);
 // Fail closed at the database level too: an AI/self-reported row cannot masquerade as human verified.
 await assert.rejects(engine.exec("INSERT INTO passport_achievement_reviews(user_id,organization_id,competency_id,status) VALUES('learner-b',2,"+
  selfReported.data.id+",'verified')"),/passport_human_verification_required|check constraint/i);
 console.log("PASS: strict three-layer separation, opt-in AI and review, account isolation, institution authority, human audit and revocation.");

 console.log("PASS: schema replay, unauthenticated denial, adult preferences, private links, malformed URLs, owner isolation, cross-owner evidence denial, mastery boundaries and deletion.");
}finally{
 server.close();
 await engine.close();
}
