import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { build } = require("esbuild");
const dir = await mkdtemp(path.join(tmpdir(), "cabo-private-blob-"));
after(async()=>{ await rm(dir,{force:true,recursive:true}); });
const outfile = path.join(dir,"private-blob.mjs");
await build({
  entryPoints:[fileURLToPath(new URL("../lib/privateBlob.ts",import.meta.url))],
  platform:"node",format:"esm",bundle:true,outfile,logLevel:"silent",
});
const {blobUploadStatus,isBlobObjectPath,blobKeyForPath,newBlobObjectPath,MAX_BLOB_FILE_BYTES} =
  await import(pathToFileURL(outfile).href);

test("private storage is disabled until both credential and privacy review are present",()=>{
  assert.equal(blobUploadStatus({}),"disabled");
  assert.equal(blobUploadStatus({CABO_BLOB_UPLOADS_ENABLED:"true"}),"invalid");
  assert.equal(blobUploadStatus({
    CABO_BLOB_UPLOADS_ENABLED:"true",UPSTASH_BLOB_TOKEN:"fake-test-token",
  }),"invalid");
  assert.equal(blobUploadStatus({
    CABO_BLOB_UPLOADS_ENABLED:"true",UPSTASH_BLOB_TOKEN:"fake-test-token",
    CABO_BLOB_PRIVACY_REVIEW_APPROVED:"true",
  }),"enabled");
  assert.equal(blobUploadStatus({
    CABO_BLOB_UPLOADS_ENABLED:"false",UPSTASH_BLOB_TOKEN:"fake-test-token",
    CABO_BLOB_PRIVACY_REVIEW_APPROVED:"true",
  }),"disabled");
});
test("opaque material paths cannot inject traversal, tenant names, or user-controlled keys",()=>{
  const p=newBlobObjectPath();
  assert.equal(isBlobObjectPath(p),true);
  assert.match(blobKeyForPath(p),/^private\/materials\/[a-f0-9-]{36}$/);
  for(const unsafe of [
    "/blob-uploads/../../sensitive", "/blob-uploads/u1/photo.pdf",
    "/blob-uploads/bad", "/blob-uploads/12345678-1234-1234-1234-1234567890ab/",
    "/objects/private/materials/foo", "https://example.org/blob-uploads/foobar"
  ]) {
    assert.equal(isBlobObjectPath(unsafe),false);
    assert.throws(()=>blobKeyForPath(unsafe),/Invalid private document path/);
  }
});
test("private pilot caps individual files to eight MiB",()=>{
  assert.equal(MAX_BLOB_FILE_BYTES,8*1024*1024);
});
