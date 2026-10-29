import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {fileURLToPath,pathToFileURL} from "node:url";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
const require=createRequire(new URL("../../package.json",import.meta.url));
const {build}=require("esbuild");
const directory=await mkdtemp(path.join(tmpdir(),"cabo-infra-tests-"));
after(()=>rm(directory,{recursive:true,force:true}));
const file=path.join(directory,"infra.mjs");
await build({entryPoints:[fileURLToPath(new URL("../lib/redisReadiness.ts",import.meta.url))],
  bundle:true,format:"esm",platform:"node",outfile:file,logLevel:"silent"});
const {createRedisReadinessProbe}=await import(pathToFileURL(file).href);
const config={UPSTASH_REDIS_REST_URL:"https://cabo-test.upstash.io",UPSTASH_REDIS_REST_TOKEN:"demo-only-test-key"};

test("Redis readiness is optional, credential-bound and sends only PING",async()=>{
  let calls=0,now=1000;
  const probe=createRedisReadinessProbe(async(url,options)=>{
    calls++;
    assert.equal(url,config.UPSTASH_REDIS_REST_URL);
    assert.deepEqual(JSON.parse(options.body),["PING"]);
    assert.equal(options.headers.Authorization,"Bearer "+config.UPSTASH_REDIS_REST_TOKEN);
    return Response.json({result:"PONG"});
  },()=>now);
  assert.equal(await probe({}),false);
  assert.equal(await probe(config),true);
  assert.equal(await probe(config),true);
  assert.equal(calls,1);
  now+=300001;
  assert.equal(await probe(config),true);
  assert.equal(calls,2);
});
test("Redis failures return unavailable without leaking credentials",async()=>{
  let now=1000;
  const failed=createRedisReadinessProbe(async()=>Response.json({error:"bad"},{status:503}),()=>now);
  assert.equal(await failed(config),false);
  assert.equal(await failed(config),false);
  now+=30001;
  assert.equal(await failed(config),false);
  const invalid=createRedisReadinessProbe(async()=>{throw Error("should not fetch");});
  assert.equal(await invalid({...config,UPSTASH_REDIS_REST_URL:"http://localhost:6379"}),false);
  const malformed=createRedisReadinessProbe(async()=>Response.json({result:"unexpected"}));
  assert.equal(await malformed(config),false);
});
test("Concurrent probes share a single provider request",async()=>{
  let calls=0;
  const p=createRedisReadinessProbe(async()=>{
    calls++;
    await Promise.resolve();
    return Response.json({result:"PONG"});
  });
  assert.deepEqual(await Promise.all([p(config),p(config),p(config)]),[true,true,true]);
  assert.equal(calls,1);
});
