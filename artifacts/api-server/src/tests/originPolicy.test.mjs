import test from "node:test";import assert from "node:assert/strict";import {permittedBrowserOrigin,trustedOrigins,permittedMutationOrigin} from "../lib/originPolicy.ts";
const env={NODE_ENV:"production",RAILWAY_PUBLIC_DOMAIN:"cabo-learner-hub-api-testing.up.railway.app",CABO_ALLOWED_ORIGINS:"https://school.example.org"};
test("credentialed cross origin requests are allowlisted, never reflected",()=>{assert.equal(permittedBrowserOrigin("https://evil.invalid",env),false);assert.equal(permittedBrowserOrigin("https://school.example.org",env),true);assert.equal(permittedBrowserOrigin("https://cabo-learner-hub-api-testing.up.railway.app",env),true)});
test("production disallows plaintext origins and malicious URL shapes",()=>{const list=trustedOrigins({...env,CABO_ALLOWED_ORIGINS:"http://evil.invalid,https://user:pass@example.com,https://evil.invalid/path,https://safe.example"});assert.equal(list.has("http://evil.invalid"),false);assert.equal(list.has("https://safe.example"),true);assert.equal(list.has("https://evil.invalid"),false)});

test("Render same-origin writes are trusted, unrelated origins rejected",()=>{
 const render={NODE_ENV:"production",RENDER_EXTERNAL_URL:"https://cabo-hub.onrender.com"};
 assert.equal(permittedBrowserOrigin("https://cabo-hub.onrender.com",render),true);
 assert.equal(permittedBrowserOrigin("https://other.onrender.com",render),false);
});

test("session cookie write without Origin or Referer fails closed",()=>{
 assert.equal(permittedMutationOrigin({cookie:"sid=opaque"},env),false);
 assert.equal(permittedMutationOrigin({cookie:"sid=opaque",origin:""},env),false);
 assert.equal(permittedMutationOrigin({cookie:"sid=opaque",origin:"null"},env),false);
});
test("cross-site cookie writes cannot spoof an acceptable referer when Origin is evil",()=>{
 assert.equal(permittedMutationOrigin({cookie:"sid=opaque",origin:"https://evil.invalid",referer:"https://school.example.org/learner"},env),false);
 assert.equal(permittedMutationOrigin({cookie:"sid=opaque",referer:"https://evil.invalid/hack"},env),false);
 assert.equal(permittedMutationOrigin({cookie:"sid=opaque",referer:"not-a-url"},env),false);
});
test("verified origin or referer permits browser writes",()=>{
 assert.equal(permittedMutationOrigin({cookie:"sid=opaque",origin:"https://school.example.org"},env),true);
 assert.equal(permittedMutationOrigin({cookie:"sid=opaque",referer:"https://school.example.org/assessments"},env),true);
});
test("origin-less native bearer requests with no cookies remain supported",()=>{
 assert.equal(permittedMutationOrigin({},env),true);
 assert.equal(permittedMutationOrigin({cookie:"",referer:undefined},env),true);
});
test("Authorization does not exempt cookie-bearing browser writes",()=>{
 assert.equal(permittedMutationOrigin({cookie:"sid=opaque"},env),false);
});
