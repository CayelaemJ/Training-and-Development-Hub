import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const require=createRequire(new URL("../../package.json", import.meta.url));
const { build }=require("esbuild");
const dir=await mkdtemp(path.join(tmpdir(),"cabo-material-policy-"));
after(async()=>{await rm(dir,{force:true,recursive:true});});
const outfile=path.join(dir,"policy.mjs");
await build({entryPoints:[fileURLToPath(new URL("../lib/uploadPolicy.ts",import.meta.url))],
  bundle:true,platform:"node",format:"esm",outfile,logLevel:"silent"});
const {validateMaterialSignature,validateDeclaredMaterialType,MaterialReadError}=await import(pathToFileURL(outfile).href);
const bytes=(...x)=>Uint8Array.from(x);
test("rejects MIME extension mismatch without accepting MIME as proof",()=>{
  assert.doesNotThrow(()=>validateDeclaredMaterialType("study.pdf","application/pdf"));
  assert.doesNotThrow(()=>validateDeclaredMaterialType("README.md","text/plain; charset=utf-8"));
  assert.doesNotThrow(()=>validateDeclaredMaterialType("sheet.xlsx","application/octet-stream"));
  assert.throws(()=>validateDeclaredMaterialType("study.pdf","text/html"),MaterialReadError);
  assert.throws(()=>validateDeclaredMaterialType("study.exe","application/octet-stream"),MaterialReadError);
  assert.throws(()=>validateDeclaredMaterialType("photo.png","image/jpeg"),MaterialReadError);
});
test("rejects disguised executable and HTML binary uploads",()=>{
  assert.doesNotThrow(()=>validateMaterialSignature("doc.pdf",Buffer.from("%PDF-1.7\nHello")));
  assert.throws(()=>validateMaterialSignature("doc.pdf",Buffer.from("MZsome executable")),MaterialReadError);
  assert.doesNotThrow(()=>validateMaterialSignature("picture.png",bytes(137,80,78,71,13,10,26,10,0,0)));
  assert.throws(()=>validateMaterialSignature("picture.png",bytes(0x3c,0x68,0x74,0x6d,0x6c)),MaterialReadError);
  assert.doesNotThrow(()=>validateMaterialSignature("picture.jpg",bytes(0xff,0xd8,0xff,0xd9)));
  assert.throws(()=>validateMaterialSignature("picture.webp",bytes(0x52,0x49,0x46,0x46,0,0,0,0,0x58,0x58,0x58,0x58)),MaterialReadError);
  assert.doesNotThrow(()=>validateMaterialSignature("paper.docx",bytes(0x50,0x4b,0x03,0x04,0,0,0)));
  assert.throws(()=>validateMaterialSignature("paper.docx",Buffer.from("not a zip")),MaterialReadError);
});
test("text file rejects embedded NUL and unknown types",()=>{
  assert.doesNotThrow(()=>validateMaterialSignature("notes.txt",Buffer.from("Grade 6 mathematics.")));
  assert.throws(()=>validateMaterialSignature("notes.txt",bytes(65,0,66)),MaterialReadError);
  assert.throws(()=>validateMaterialSignature("notes.xyz",Buffer.from("a")),MaterialReadError);
  assert.throws(()=>validateMaterialSignature("notes.csv",Buffer.alloc(0)),MaterialReadError);
});
