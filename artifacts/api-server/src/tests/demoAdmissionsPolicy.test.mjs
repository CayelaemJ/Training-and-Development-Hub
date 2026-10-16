import test from "node:test";
import assert from "node:assert/strict";
import {syntheticCandidate,canAdvanceDemoApplication} from "../lib/demoAdmissionsPolicy.ts";
test("only explicitly synthetic CABO fixtures may enter demo university review",()=>{
 assert.equal(syntheticCandidate("cabo-demo-child-11"),true);
 assert.equal(syntheticCandidate("cabo-fixture-learner-001"),true);
 assert.equal(syntheticCandidate("user-real-123"),false);
});
test("real university or incorrect transition cannot receive simulated offer",()=>{
 assert.equal(canAdvanceDemoApplication("cabo-demo-child-11","CABO DEMO | University of Future Skills","under_review","offer"),true);
 assert.equal(canAdvanceDemoApplication("user-real-123","CABO DEMO | University of Future Skills","under_review","offer"),false);
 assert.equal(canAdvanceDemoApplication("cabo-demo-child-11","University of Pretoria","under_review","offer"),false);
 assert.equal(canAdvanceDemoApplication("cabo-demo-child-11","CABO DEMO | University of Future Skills","draft","offer"),false);
});
