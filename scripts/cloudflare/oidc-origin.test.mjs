import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Import the production TypeScript origin policy in isolation: no external
// identity provider, database, server, or real user account is contacted.
const source=fs.readFileSync('artifacts/api-server/src/lib/originPolicy.ts','utf8');
const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const {trustedOidcRequestOrigin, trustedOrigins, safeOidcReturnPath}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

test('Render hostname stays valid without Cloudflare migration',()=>{
  const env={NODE_ENV:'production',RENDER_EXTERNAL_URL:'https://cabo-learning-hub-pilot.onrender.com'};
  assert.equal(trustedOidcRequestOrigin({host:'cabo-learning-hub-pilot.onrender.com'},env),'https://cabo-learning-hub-pilot.onrender.com');
  assert.ok(trustedOrigins(env).has('https://cabo-learning-hub-pilot.onrender.com'));
});
test('Cloudflare hostname only works after explicit allowlisting and trusted proxy',()=>{
  const env={NODE_ENV:'production',RENDER_EXTERNAL_URL:'https://cabo-learning-hub-pilot.onrender.com',TRUST_PROXY_HOPS:'1',CABO_ALLOWED_ORIGINS:'https://cabo-learning-static.pages.dev'};
  assert.equal(trustedOidcRequestOrigin({host:'cabo-learning-hub-pilot.onrender.com','x-forwarded-host':'cabo-learning-static.pages.dev','x-forwarded-proto':'https'},env),'https://cabo-learning-static.pages.dev');
  assert.equal(trustedOidcRequestOrigin({host:'cabo-learning-hub-pilot.onrender.com','x-forwarded-host':'attacker.invalid','x-forwarded-proto':'https'},env),'https://cabo-learning-hub-pilot.onrender.com');
});
test('untrusted forwarded host and OAuth callback poisoning are rejected',()=>{
  const env={NODE_ENV:'production',RENDER_EXTERNAL_URL:'https://cabo-learning-hub-pilot.onrender.com'};
  const bad=['attacker.invalid','cabo-learning-hub-pilot.onrender.com.attacker.invalid','user@cabo-learning-hub-pilot.onrender.com','cabo-learning-hub-pilot.onrender.com/path','evil.invalid, cabo-learning-hub-pilot.onrender.com'];
  for(const host of bad){
    assert.equal(trustedOidcRequestOrigin({host},env),null,host);
  }
  assert.equal(trustedOidcRequestOrigin({host:'cabo-learning-hub-pilot.onrender.com','x-forwarded-host':'attacker.invalid','x-forwarded-proto':'https'},env),'https://cabo-learning-hub-pilot.onrender.com');
  assert.equal(trustedOidcRequestOrigin({host:'attacker.invalid','x-forwarded-host':'cabo-learning-hub-pilot.onrender.com','x-forwarded-proto':'https'},env),null);
});
test('spoofed proxies cannot sneak in insecure scheme or comma-separated host list',()=>{
  const env={NODE_ENV:'production',RENDER_EXTERNAL_URL:'https://cabo-learning-hub-pilot.onrender.com',TRUST_PROXY_HOPS:'1',CABO_ALLOWED_ORIGINS:'https://cabo-learning-static.pages.dev'};
  assert.equal(trustedOidcRequestOrigin({host:'cabo-learning-hub-pilot.onrender.com','x-forwarded-host':'cabo-learning-static.pages.dev','x-forwarded-proto':'http'},env),'https://cabo-learning-hub-pilot.onrender.com');
  assert.equal(trustedOidcRequestOrigin({host:'cabo-learning-hub-pilot.onrender.com','x-forwarded-host':'cabo-learning-static.pages.dev, attacker.invalid','x-forwarded-proto':'https'},env),'https://cabo-learning-hub-pilot.onrender.com');
  assert.equal(trustedOidcRequestOrigin({host:'attacker.invalid','x-forwarded-host':'cabo-learning-static.pages.dev','x-forwarded-proto':'https, http'},env),null);
});
test('reject unknown hosts even if no allowlist is provided',()=>{
  assert.equal(trustedOidcRequestOrigin({host:'localhost:3000'},{NODE_ENV:'production'}),null);
  assert.equal(trustedOidcRequestOrigin({host:'attacker.invalid'},{NODE_ENV:'production'}),null);
});

test('OAuth return path is local, rejects host separators and redirect tricks',()=>{
  for(const input of ['//attacker.invalid','/\\\\attacker.invalid','https://attacker.invalid','/safe\\\\attacker.invalid',null,42,'\\nhttps://attacker.invalid']){
    assert.equal(safeOidcReturnPath(input),'/',JSON.stringify(input));
  }
  assert.equal(safeOidcReturnPath('/learner/dashboard?term=2#overview'),'/learner/dashboard?term=2#overview');
  assert.equal(safeOidcReturnPath('/'),'/');
});
