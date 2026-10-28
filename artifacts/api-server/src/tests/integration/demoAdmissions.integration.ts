import assert from "node:assert/strict";
import express from "express";
import router from "../../routes/demoAdmissionsInbox";
import {engine} from "./supportTestDb";
await engine.exec(`
 CREATE TABLE users(id varchar PRIMARY KEY);
 CREATE TABLE admission_institutions(id serial PRIMARY KEY,name varchar NOT NULL,official_url text,province varchar,route varchar,verification varchar,created_at timestamptz DEFAULT now());
 CREATE TABLE admission_programmes(id serial PRIMARY KEY,institution_id integer REFERENCES admission_institutions(id),name varchar,faculty varchar,qualification varchar,requirements text,status varchar,created_at timestamptz DEFAULT now());
 CREATE TABLE admission_applications(id serial PRIMARY KEY,candidate_id varchar REFERENCES users(id),programme_id integer REFERENCES admission_programmes(id),status varchar,candidate_statement text,disclosure_approved_at timestamptz,external_reference varchar,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 CREATE TABLE admission_events(id serial PRIMARY KEY,application_id integer REFERENCES admission_applications(id),actor_id varchar REFERENCES users(id),from_status varchar,to_status varchar,created_at timestamptz DEFAULT now());
 INSERT INTO users(id) VALUES ('test-admin'),('cabo-fixture-student'),('real-user'),('outsider');
 INSERT INTO admission_institutions(id,name) VALUES (1,'CABO DEMO | University of Future Skills'),(2,'Real University');
 INSERT INTO admission_programmes(id,institution_id,name) VALUES (1,1,'Synthetic programme'),(2,2,'Real programme');
 INSERT INTO admission_applications(id,candidate_id,programme_id,status,external_reference) VALUES
 (1,'cabo-fixture-student',1,'external_submission_recorded','PRIVATE-REFERENCE'),
 (2,'real-user',1,'external_submission_recorded',NULL),
 (3,'cabo-fixture-student',2,'external_submission_recorded',NULL),
 (4,'cabo-fixture-student',1,'draft',NULL);
`);
Object.assign(process.env,{CABO_ENVIRONMENT:'testing',CABO_TEST_DATABASE_ISOLATED:'true',ENABLE_DEMO_ADMISSIONS_INBOX:'true',ENABLE_CABO_SUPERADMIN:'true',CABO_SUPERADMIN_USER_ID:'test-admin'});
const app=express();app.use(express.json());app.use((req,_res,next)=>{
 req.user=req.headers['x-test-user']?({id:String(req.headers['x-test-user'])} as any):undefined;
 req.isAuthenticated=(()=>!!req.user) as any;next();
});app.use('/api',router);
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const url='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/platform/demo/admissions-inbox';
async function call(user:string,path='',body?:unknown){
 const r=await fetch(url+path,{method:body===undefined?'GET':'POST',headers:{'x-test-user':user,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:r.status,data:await r.json().catch(()=>null),cache:r.headers.get('cache-control')};
}
try{
 assert.equal((await call('')).status,401);
 assert.equal((await call('','/1/decision',{action:'under_review'})).status,401);
 assert.equal((await call('outsider')).status,403);
 assert.equal((await call('outsider','/1/decision',{action:'under_review'})).status,403);
 process.env.ENABLE_DEMO_ADMISSIONS_INBOX='false';assert.equal((await call('test-admin')).status,503);process.env.ENABLE_DEMO_ADMISSIONS_INBOX='true';
 process.env.CABO_ENVIRONMENT='production';assert.equal((await call('test-admin','/1/decision',{action:'under_review'})).status,503);process.env.CABO_ENVIRONMENT='testing';
 process.env.CABO_TEST_DATABASE_ISOLATED='false';assert.equal((await call('test-admin')).status,503);process.env.CABO_TEST_DATABASE_ISOLATED='true';
 const inbox=await call('test-admin');assert.equal(inbox.status,200);assert.match(inbox.cache??'',/no-store/);assert.ok(Array.isArray(inbox.data));assert.deepEqual(inbox.data.map((r:any)=>r.id).sort(),[1,4]);assert.ok(!JSON.stringify(inbox.data).includes('PRIVATE-REFERENCE'));
 assert.equal((await call('test-admin','/2/decision',{action:'under_review'})).status,404);
 assert.equal((await call('test-admin','/3/decision',{action:'under_review'})).status,409);
 assert.equal((await call('test-admin','/4/decision',{action:'offer'})).status,409);
 assert.equal((await call('test-admin','/1/decision',{action:'under_review',candidateId:'real-user'})).status,400);
 assert.equal((await call('test-admin','/invalid/decision',{action:'under_review'})).status,400);
 assert.equal((await call('test-admin','/1/decision',{action:'under_review'})).status,200);
 const concurrent=await Promise.all([call('test-admin','/1/decision',{action:'offer'}),call('test-admin','/1/decision',{action:'unsuccessful'})]);
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 const events=await engine.query('SELECT * FROM admission_events ORDER BY id');assert.equal(events.rows.length,2);
 const real=await engine.query("SELECT status FROM admission_applications WHERE id IN (2,3)");assert.ok(real.rows.every((r:any)=>r.status==='external_submission_recorded'));
 console.log('PASS: Render-only opt-in, anonymous/nonadmin denial, synthetic-only inbox, redacted references, real-applicant/institution isolation, strict input, forward-only decisions, concurrent conflict and audit events.');
}finally{await new Promise<void>(r=>server.close(()=>r()));await engine.close();}
