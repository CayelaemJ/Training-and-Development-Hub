import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {fileURLToPath,pathToFileURL} from "node:url";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
const require=createRequire(new URL("../../package.json",import.meta.url));
const {build}=require("esbuild");
const directory=await mkdtemp(path.join(tmpdir(),"cabo-notice-"));
after(()=>rm(directory,{recursive:true,force:true}));
const outfile=path.join(directory,"mail.mjs");
await build({entryPoints:[fileURLToPath(new URL("../lib/transactionalNotices.ts",import.meta.url))],
 platform:"node",bundle:true,format:"esm",outfile,logLevel:"silent"});
const {noticesEnabled,composeSafeNotice,sendTransactionalNotice}=
 await import(pathToFileURL(outfile).href);
const eventId="a95c8bc2-a1fd-4e97-8701-124a034bef75";
const message={to:"synthetic@example.org",eventId,kind:"guardian_review_requested",deliveryApproved:true};
const env={
 CABO_TRANSACTIONAL_EMAIL_ENABLED:"true",RESEND_API_KEY:"test-email-provider-token",
 CABO_FROM_EMAIL:"notices@example.org",UPSTASH_REDIS_REST_URL:"https://cabo-test.upstash.io",
 UPSTASH_REDIS_REST_TOKEN:"test-redis-token",CABO_REDIS_PREFIX:"cabo-test",
};
test("no provider, token or approval means no email sent",async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;return Response.json({result:1})};
 assert.equal(noticesEnabled({}),false);
 assert.equal(await sendTransactionalNotice(message,fetcher,{}),"disabled");
 assert.equal(await sendTransactionalNotice(message,fetcher,{...env,RESEND_API_KEY:""}),"disabled");
 assert.equal(calls,0);
 assert.throws(()=>composeSafeNotice({...message,deliveryApproved:false}));
 assert.throws(()=>composeSafeNotice({...message,to:"child\r\nBCC:attacker@example.org"}));
 assert.throws(()=>composeSafeNotice({...message,eventId:"not-a-uuid"}));
});
test("sends only approved generic text with hashed idempotency and no private keys",async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  return Response.json(calls.length===1?{result:1}:{id:"dummy"});
 };
 assert.equal(await sendTransactionalNotice(message,fetcher,env,new Date("2026-10-29T09:00:00Z")),"accepted");
 assert.equal(calls.length,2);
 const [redis,email]=calls;
 const cmd=JSON.parse(redis.options.body);
 assert.equal(cmd[0],"EVAL");
 assert.ok(cmd.includes("75")&&cmd.includes("1500"));
 assert.ok(!redis.options.body.includes("synthetic@example.org"));
 assert.equal(email.url,"https://api.resend.com/emails");
 const payload=JSON.parse(email.options.body);
 assert.deepEqual(payload.to,["synthetic@example.org"]);
 assert.ok(!payload.subject.includes("@")&&!payload.text.includes("synthetic@example.org"));
 assert.ok(!payload.text.includes("guardian name")&&!payload.text.includes("birth certificate"));
 assert.match(email.options.headers["Idempotency-Key"],/^cabo-[0-9a-f]{64}$/);
});
test("duplicate reservation never resends email or consumes new quota",async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;return Response.json({result:2})};
 assert.equal(await sendTransactionalNotice(message,fetcher,env),"deduplicated");
 assert.equal(calls,1);
});
test("quota exhaustion and provider failures do not expose details",async()=>{
 const blocked=async()=>Response.json({result:0});
 assert.equal(await sendTransactionalNotice(message,blocked,env),"limit_reached");
 await assert.rejects(sendTransactionalNotice(message,async()=>Response.json({result:"no"}),env),/Unverified notification quota/);
 let calls=0;
 await assert.rejects(sendTransactionalNotice(message,async()=>{
  calls++;return calls===1?Response.json({result:1}):Response.json({error:"secret token"}, {status:500});
 },env),/Transactional email provider unavailable/);
});
