import test from "node:test";
import assert from "node:assert/strict";
import {oidcRequestOrigin,safeReturnPath} from "../lib/oidcRedirectPolicy.ts";

const production = {
 NODE_ENV:"production",
 RENDER_EXTERNAL_URL:"https://cabo-hub.onrender.com",
 RAILWAY_PUBLIC_DOMAIN:"cabo-learner-hub-api-testing.up.railway.app"
};
test("OIDC callback host must match configured production deployment",()=>{
 assert.equal(oidcRequestOrigin("cabo-hub.onrender.com",production),"https://cabo-hub.onrender.com");
 assert.equal(oidcRequestOrigin("cabo-learner-hub-api-testing.up.railway.app",production),"https://cabo-learner-hub-api-testing.up.railway.app");
 assert.equal(oidcRequestOrigin("attacker.example",production),null);
 assert.equal(oidcRequestOrigin("cabo-hub.onrender.com.evil.invalid",production),null);
 assert.equal(oidcRequestOrigin("user@cabo-hub.onrender.com",production),null);
});
test("production never invents a callback domain or trusts arbitrary request host",()=>{
 assert.equal(oidcRequestOrigin("anything.invalid",{NODE_ENV:"production"}),null);
 assert.equal(oidcRequestOrigin(undefined,production),null);
});
test("explicit local development port is permitted without forwarded headers",()=>{
 assert.equal(oidcRequestOrigin("localhost:5000",{NODE_ENV:"development",PORT:"5000"}),"http://localhost:5000");
 assert.equal(oidcRequestOrigin("127.0.0.1:5000",{NODE_ENV:"development",PORT:"5000"}),"http://127.0.0.1:5000");
});
test("safe return path rejects external origins and browser slash normalization",()=>{
 for(const bad of ["//evil.invalid","/\\evil.invalid","/foo\\evil.invalid","/%2f%2fevil.invalid","/%5cevil.invalid","https://evil.invalid",null,42,"/foo\nbar"]){
  assert.equal(safeReturnPath(bad),"/",String(bad));
 }
});
test("ordinary same-origin deep links are retained",()=>{
 assert.equal(safeReturnPath("/"),"/");
 assert.equal(safeReturnPath("/dashboard?tab=reports"),"/dashboard?tab=reports");
 assert.equal(safeReturnPath("/learning/grade-5#progress"),"/learning/grade-5#progress");
});
