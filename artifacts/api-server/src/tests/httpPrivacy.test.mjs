import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {fileURLToPath,pathToFileURL} from "node:url";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
const require=createRequire(new URL("../../package.json",import.meta.url));
const {build}=require("esbuild");
const dir=await mkdtemp(path.join(tmpdir(),"cabo-private-logging-"));
after(()=>rm(dir,{recursive:true,force:true}));
const outfile=path.join(dir,"httpPrivacy.mjs");
await build({entryPoints:[fileURLToPath(new URL("../lib/httpPrivacy.ts",import.meta.url))],
  platform:"node",bundle:true,format:"esm",outfile,logLevel:"silent"});
const {safeRequestCategory,safeErrorType,safeRequestReference}=
  await import(pathToFileURL(outfile).href);

test("request metadata never includes dynamic learner, email or document paths",()=>{
  assert.equal(safeRequestCategory("/api/materials/14?token=SECRET"),"/api/materials");
  assert.equal(safeRequestCategory("/api/organizations/2/learners/personal@example.org"),"/api/organizations");
  assert.equal(safeRequestCategory("/api/native/token?refresh_token=SECRET"),"/api/native");
  assert.equal(safeRequestCategory("/api/mychild@example.org/private/123"),"/api/other");
  assert.equal(safeRequestCategory("https://evil.example/api/materials/17"),"/other");
  assert.equal(safeRequestCategory("/api/unknown-child-path/secret"),"/api/other");
  assert.equal(safeRequestCategory("/sign-in?password=verysecret"),"/other");
  assert.equal(safeRequestCategory(null),"/other");
});
test("error metadata never reports raw exception messages or stacks",()=>{
  const e=new Error("Bearer secret-token; guardian email is name@example.org");
  assert.equal(safeErrorType(e),"Error");
  assert.equal(safeErrorType(new TypeError("private document filename")),"TypeError");
  assert.equal(safeErrorType({message:"student ID is secret"}),"Unknown");
  const custom=new Error("some private child data");
  custom.name="VendorAuthError-with-secret";
  assert.equal(safeErrorType(custom),"ApplicationError");
});
test("request references reject user-controlled URLs, emails and control characters",()=>{
  assert.equal(safeRequestReference(17),"17");
  assert.equal(safeRequestReference("abc_F-84"),"abc_F-84");
  assert.equal(safeRequestReference("one@example.org"),null);
  assert.equal(safeRequestReference("x\r\nSet-Cookie: personal"),null);
  assert.equal(safeRequestReference(-1),null);
  assert.equal(safeRequestReference("A".repeat(65)),null);
});
