import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import {contentDigest,signingPayload,configuredReportSigner,verifyReportSignature} from "../lib/reportCryptography.ts";
test("report signatures bind snapshot digest, learner, institution, year and version",()=>{
 const {privateKey}=generateKeyPairSync("ed25519");
 const old=process.env.CABO_REPORT_SIGNING_PRIVATE_KEY_PKCS8_B64;
 try{
  process.env.CABO_REPORT_SIGNING_PRIVATE_KEY_PKCS8_B64=privateKey.export({format:"der",type:"pkcs8"}).toString("base64");
  const signer=configuredReportSigner();
  assert.ok(signer);
  const digest=contentDigest({grade:"5",subjects:[{name:"Mathematics",percentage:80}]});
  const payload=signingPayload(14,"synthetic-learner",2026,1,digest);
  const sig=signer.signData(payload);
  assert.equal(verifyReportSignature(payload,sig,signer.publicKeyPem),true);
  assert.equal(verifyReportSignature(signingPayload(14,"another-learner",2026,1,digest),sig,signer.publicKeyPem),false);
  assert.equal(verifyReportSignature(signingPayload(14,"synthetic-learner",2026,2,digest),sig,signer.publicKeyPem),false);
  assert.equal(verifyReportSignature(signingPayload(15,"synthetic-learner",2026,1,digest),sig,signer.publicKeyPem),false);
  assert.equal(verifyReportSignature(signingPayload(14,"synthetic-learner",2026,1,contentDigest({grade:"6"})),sig,signer.publicKeyPem),false);
 }finally{
  if(old===undefined)delete process.env.CABO_REPORT_SIGNING_PRIVATE_KEY_PKCS8_B64;
  else process.env.CABO_REPORT_SIGNING_PRIVATE_KEY_PKCS8_B64=old;
 }
});
test("unsigned pilot reports are not falsely represented as signed",()=>{
 const original=process.env.CABO_REPORT_SIGNING_PRIVATE_KEY_PKCS8_B64;
 delete process.env.CABO_REPORT_SIGNING_PRIVATE_KEY_PKCS8_B64;
 assert.equal(configuredReportSigner(),null);
 if(original!==undefined)process.env.CABO_REPORT_SIGNING_PRIVATE_KEY_PKCS8_B64=original;
});

test("canonical digest survives JSONB-like object key reordering",()=>{
 const a={grade:"5",year:2026,subjects:[{name:"Mathematics",percentage:80}]};
 const b={subjects:[{percentage:80,name:"Mathematics"}],year:2026,grade:"5"};
 assert.equal(contentDigest(a),contentDigest(b));
 assert.notEqual(contentDigest(a),contentDigest({grade:"5",year:2026,subjects:[{name:"Mathematics",percentage:81}]}));
});
