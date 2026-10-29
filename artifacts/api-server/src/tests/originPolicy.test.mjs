import test from "node:test";import assert from "node:assert/strict";import {permittedBrowserOrigin,permittedMutationOrigin,trustedOrigins} from "../lib/originPolicy.ts";
const env={NODE_ENV:"production",RAILWAY_PUBLIC_DOMAIN:"cabo-learner-hub-api-testing.up.railway.app",CABO_ALLOWED_ORIGINS:"https://school.example.org"};
test("credentialed cross origin requests are allowlisted, never reflected",()=>{assert.equal(permittedBrowserOrigin("https://evil.invalid",env),false);assert.equal(permittedBrowserOrigin("https://school.example.org",env),true);assert.equal(permittedBrowserOrigin("https://cabo-learner-hub-api-testing.up.railway.app",env),true)});
test("production disallows plaintext origins and malicious URL shapes",()=>{const list=trustedOrigins({...env,CABO_ALLOWED_ORIGINS:"http://evil.invalid,https://user:pass@example.com,https://evil.invalid/path,https://safe.example"});assert.equal(list.has("http://evil.invalid"),false);assert.equal(list.has("https://safe.example"),true);assert.equal(list.has("https://evil.invalid"),false)});

test("Render same-origin writes are trusted, unrelated origins rejected",()=>{
 const render={NODE_ENV:"production",RENDER_EXTERNAL_URL:"https://cabo-hub.onrender.com"};
 assert.equal(permittedBrowserOrigin("https://cabo-hub.onrender.com",render),true);
 assert.equal(permittedBrowserOrigin("https://other.onrender.com",render),false);
});

test("Cookie-backed mutations require a trusted Origin or Referer",()=>{
 const env={NODE_ENV:"production",RENDER_EXTERNAL_URL:"https://cabo-hub.onrender.com"};
 assert.equal(permittedMutationOrigin({origin:"https://cabo-hub.onrender.com",cookie:"sid=fake"},env),true);
 assert.equal(permittedMutationOrigin({origin:"https://evil.invalid",cookie:"sid=fake"},env),false);
 assert.equal(permittedMutationOrigin({referer:"https://cabo-hub.onrender.com/home",cookie:"sid=fake"},env),true);
 assert.equal(permittedMutationOrigin({referer:"https://evil.invalid",cookie:"sid=fake"},env),false);
 assert.equal(permittedMutationOrigin({cookie:"sid=fake"},env),false);
 assert.equal(permittedMutationOrigin({},env),true);
 assert.equal(permittedMutationOrigin({origin:""},env),false);
});
