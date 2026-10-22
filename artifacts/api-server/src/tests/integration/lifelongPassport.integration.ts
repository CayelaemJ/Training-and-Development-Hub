// Synthetic API/database acceptance for the private lifelong passport.
// Uses the same route and Drizzle schema as the application, with PGlite.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import passportRouter from "../../routes/lifelongPassport";
import { engine } from "./supportTestDb";

await engine.exec("CREATE TABLE users(id varchar PRIMARY KEY)");
const migration=await readFile("lib/db/migrations/20261022_lifelong_passport_foundation.sql","utf8");
await engine.exec(migration);
await engine.exec(migration); // schema replay must remain safe
await engine.exec("INSERT INTO users(id) VALUES ('adult-a'),('learner-b')");

const app=express();
app.use(express.json());
app.use((req,_res,next)=>{
 req.user=req.headers["x-test-user"]?({id:String(req.headers["x-test-user"])} as any):undefined;
 req.isAuthenticated=(()=>!!req.user) as any;
 next();
});
app.use("/api",passportRouter);
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
 console.log("PASS: schema replay, unauthenticated denial, adult preferences, private links, malformed URLs, owner isolation, cross-owner evidence denial, mastery boundaries and deletion.");
}finally{
 server.close();
 await engine.close();
}
