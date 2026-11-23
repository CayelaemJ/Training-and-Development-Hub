import test from "node:test";
import assert from "node:assert/strict";
import {validateLearningHubCutover} from "../cloudflare/full-stack/gate.mjs";
const original={CABO_LEARNING_BACKEND_ENABLED:"true",CABO_LEARNING_HOST:"learning.example.org",
  CABO_LEARNING_CONTAINER:{getByName(){}},CABO_LEARNING_DATABASE_URL:"synthetic",
  CABO_CHILD_DATA_REVIEW_COMPLETE:"true",CABO_MFA_E2E_VERIFIED:"true",
  CABO_TENANT_ISOLATION_E2E_VERIFIED:"true",CABO_OIDC_ORIGIN_VERIFIED:"true"};
test("real full-stack deployment requires every child-privacy and identity gate",()=>{
 assert.equal(validateLearningHubCutover(original,"learning.example.org").ready,true);
 for(const key of ["CABO_LEARNING_BACKEND_ENABLED","CABO_CHILD_DATA_REVIEW_COMPLETE",
  "CABO_MFA_E2E_VERIFIED","CABO_TENANT_ISOLATION_E2E_VERIFIED","CABO_OIDC_ORIGIN_VERIFIED"]){
  assert.equal(validateLearningHubCutover({...original,[key]:"false"},"learning.example.org").ready,false,key);
 }
});
test("no valid database or unmatched origin prevents any child account traffic",()=>{
 assert.equal(validateLearningHubCutover({...original,CABO_LEARNING_DATABASE_URL:""},"learning.example.org").ready,false);
 assert.equal(validateLearningHubCutover(original,"other.example.org").ready,false);
 assert.equal(validateLearningHubCutover({...original,CABO_LEARNING_CONTAINER:undefined},"learning.example.org").ready,false);
});
test("all controls default to blocking",()=>{
 assert.equal(validateLearningHubCutover({},"learning.example.org").ready,false);
});
