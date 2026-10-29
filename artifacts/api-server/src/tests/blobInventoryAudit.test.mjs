import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {fileURLToPath,pathToFileURL} from "node:url";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
const require=createRequire(new URL("../../package.json",import.meta.url));
const {build}=require("esbuild");
const directory=await mkdtemp(path.join(tmpdir(),"cabo-audit-tests-"));
after(()=>rm(directory,{recursive:true,force:true}));
const outfile=path.join(directory,"audit.mjs");
await build({entryPoints:[fileURLToPath(new URL("../lib/blobInventoryAudit.ts",import.meta.url))],
  bundle:true,format:"esm",platform:"node",outfile,logLevel:"silent"});
const {summarizeBlobInventory,objectKeyFromStoredPath}=await import(pathToFileURL(outfile).href);
const ids=[
"bded842c-5c18-45b0-9d97-c788ee51b20d",
"9d3f31b4-d681-439d-9ba0-39de2ffb95c5",
"1580046a-929f-4c1c-80b6-e293dc4a224f",
"480d98d1-0c4d-48d5-87d9-02be4d969384",
];
const key=id=>"private/materials/"+id;
test("Inventory reports counts and bytes but never filenames or object keys",()=>{
  const summary=summarizeBlobInventory([
    {path:key(ids[0]),size:1024},{path:key(ids[1]),size:2048},{path:key(ids[2]),size:4096},
  ],new Set([key(ids[0]),key(ids[3])]),new Set([key(ids[1])]));
  assert.deepEqual(summary,{
    scannedObjects:3,scannedBytes:7168,referencedMaterialObjects:1,
    pendingUploadObjects:1,unreferencedObjects:1,unreferencedBytes:4096,
    recordedMaterialsWithoutObject:1,outstandingIntentsWithoutObject:0,
  });
  for(const id of ids)assert.ok(!JSON.stringify(summary).includes(id));
});
test("Reject unexpected provider keys, duplicates and invalid sizes",()=>{
  assert.throws(()=>summarizeBlobInventory([{path:"public/file",size:2}],new Set(),new Set()));
  assert.throws(()=>summarizeBlobInventory([{path:key(ids[0]),size:-1}],new Set(),new Set()));
  assert.throws(()=>summarizeBlobInventory([
    {path:key(ids[0]),size:1},{path:key(ids[0]),size:1},
  ],new Set(),new Set()));
});
test("Application paths cannot traverse or inject unrelated keys",()=>{
  assert.equal(objectKeyFromStoredPath("/blob-uploads/"+ids[0]),key(ids[0]));
  assert.throws(()=>objectKeyFromStoredPath("/blob-uploads/../../secrets"));
  assert.throws(()=>objectKeyFromStoredPath("/uploads/"+ids[0]));
});
