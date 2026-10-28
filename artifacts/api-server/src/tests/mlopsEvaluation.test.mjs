import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";

async function loadTsModule(relativePath){
 const source=await readFile(new URL(relativePath,import.meta.url),"utf8");
 const compiled=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
 return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
const {evaluateAiMarking}=await loadTsModule("../lib/mlopsEvaluation.ts");
const {canAccessMLOps}=await loadTsModule("../lib/mlopsAccessPolicy.ts");

test("AI marking evaluation passes only on enough accurate human-reviewed samples",()=>{
 const samples=Array.from({length:30},(_,index)=>({aiMarks:8,educatorMarks:8,maximumMarks:10,flaggedForReview:index===0}));
 const result=evaluateAiMarking(samples);
 assert.equal(result.passed,true);
 assert.equal(result.sampleCount,30);
 assert.equal(result.normalizedMeanAbsoluteError,0);
 assert.equal(result.agreementRate,1);
 assert.equal(result.humanReviewRate,1/30);
});

test("evaluation fails closed below the minimum sample threshold",()=>{
 const result=evaluateAiMarking(Array.from({length:29},()=>({aiMarks:10,educatorMarks:10,maximumMarks:10})));
 assert.equal(result.passed,false);
 assert.deepEqual(result.reasons,["Insufficient human-reviewed samples"]);
});

test("large grading error fails the evaluation",()=>{
 const result=evaluateAiMarking(Array.from({length:30},()=>({aiMarks:0,educatorMarks:10,maximumMarks:10})));
 assert.equal(result.passed,false);
 assert.ok(result.reasons.includes("AI marks differ too much from educator marks"));
});

test("invalid marks, review flags, and thresholds are rejected",()=>{
 assert.throws(()=>evaluateAiMarking([{aiMarks:11,educatorMarks:1,maximumMarks:10}]),/Invalid assessment marks/);
 assert.throws(()=>evaluateAiMarking([{aiMarks:1,educatorMarks:1,maximumMarks:10,flaggedForReview:"yes"}]),/Invalid assessment marks/);
 assert.throws(()=>evaluateAiMarking([],{markTolerance:1.1}),/Invalid evaluation thresholds/);
});

test("MLOps access requires matching organization membership and scoped roles",()=>{
 assert.equal(canAccessMLOps(undefined,7,"view"),false);
 assert.equal(canAccessMLOps({organizationId:8,role:"teacher"},7,"view"),false);
 assert.equal(canAccessMLOps({organizationId:7,role:"learner"},7,"view"),false);
 assert.equal(canAccessMLOps({organizationId:7,role:"teacher"},7,"submit-evaluation"),true);
 assert.equal(canAccessMLOps({organizationId:7,role:"teacher"},7,"register-model"),false);
 assert.equal(canAccessMLOps({organizationId:7,role:"admin"},7,"register-model"),true);
});
