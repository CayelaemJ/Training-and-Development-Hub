import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {fileURLToPath,pathToFileURL} from "node:url";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
const require=createRequire(new URL("../../package.json",import.meta.url));
const {build}=require("esbuild");
const dir=await mkdtemp(path.join(tmpdir(),"cabo-outbox-"));
after(()=>rm(dir,{recursive:true,force:true}));
const out=path.join(dir,"outboxCrypto.mjs");
await build({entryPoints:[fileURLToPath(new URL("../lib/outboxCrypto.ts",import.meta.url))],
  platform:"node",bundle:true,format:"esm",outfile:out,logLevel:"silent"});
const {readOutboxKey,encryptRecipient,decryptRecipient}=await import(pathToFileURL(out).href);
const key=Buffer.alloc(32,17);
const eid="50706b84-a6a0-4b78-972c-1f4f2c0141ef";
test("protects recipient addresses with authenticated AES-256-GCM",()=>{
 const address="guardian.synthetic@example.org";
 const encrypted=encryptRecipient(address,eid,key);
 assert.ok(encrypted.startsWith("v1."));
 assert.equal(encrypted.includes("guardian"),false);
 assert.equal(encrypted.includes("example.org"),false);
 assert.equal(decryptRecipient(encrypted,eid,key),address);
 assert.notEqual(encryptRecipient(address,eid,key),encrypted,"random IV makes ciphertext distinct");
});
test("forbids key substitution, event substitution and modification",()=>{
 const c=encryptRecipient("test@example.org",eid,key);
 assert.throws(()=>decryptRecipient(c,eid,Buffer.alloc(32,19)),/Protected recipient authentication failed/);
 assert.throws(()=>decryptRecipient(c,"10970a94-12b0-4fc2-9c87-9479bb3fc2a1",key),/Protected recipient authentication failed/);
 const parts=c.split(".");
 parts[2]=parts[2].replace(/[A-Za-z0-9_-]/,s=>s==="A"?"B":"A");
 assert.throws(()=>decryptRecipient(parts.join("."),eid,key),/Protected recipient authentication failed/);
 assert.throws(()=>decryptRecipient("v1.bad",eid,key));
});
test("requires an exact 32-byte base64 key and valid recipient/event",()=>{
 assert.equal(readOutboxKey({CABO_NOTIFICATION_OUTBOX_KEY:key.toString("base64")}).equals(key),true);
 assert.throws(()=>readOutboxKey({}));
 assert.throws(()=>readOutboxKey({CABO_NOTIFICATION_OUTBOX_KEY:"password"}));
 assert.throws(()=>readOutboxKey({CABO_NOTIFICATION_OUTBOX_KEY:"A".repeat(44)}));
 assert.throws(()=>encryptRecipient("email-with-newline\n@example.org",eid,key));
 assert.throws(()=>encryptRecipient("test@example.org","not-a-uuid",key));
});
