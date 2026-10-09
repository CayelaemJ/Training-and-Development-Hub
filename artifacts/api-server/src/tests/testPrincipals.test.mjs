import test from "node:test";
import assert from "node:assert/strict";
import {configuredPrincipals} from "../lib/testPrincipals.ts";
const principal={username:"cabo_teacher_demo",userId:"cabo-fixture-teacher",email:"teacher@example.invalid",firstName:"Test",lastName:"Teacher",hash:"1".repeat(32)+":"+"a".repeat(128)};
test("rejects missing and malformed fixture configuration",()=>{
 assert.deepEqual(configuredPrincipals(undefined),[]);
 assert.deepEqual(configuredPrincipals("{"),[]);
 assert.deepEqual(configuredPrincipals(JSON.stringify([{...principal,userId:"admin"}])),[]);
 assert.deepEqual(configuredPrincipals(JSON.stringify([{...principal,email:"real@example.com"}])),[]);
 assert.deepEqual(configuredPrincipals(JSON.stringify([principal,principal])),[]);
});
test("accepts only valid isolated test principals",()=>{
 assert.deepEqual(configuredPrincipals(JSON.stringify([principal])),[principal]);
});
