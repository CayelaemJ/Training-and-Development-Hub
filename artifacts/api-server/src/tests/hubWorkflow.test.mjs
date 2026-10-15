import test from "node:test";
import assert from "node:assert/strict";
import {validTransition,canTransition} from "../lib/hubWorkflow.ts";
test("review workflow requires intermediate states",()=>{
 assert.equal(validTransition("draft","submitted"),true);
 assert.equal(validTransition("draft","approved"),false);
 assert.equal(validTransition("submitted","approved"),true);
 assert.equal(validTransition("approved","active"),true);
 assert.equal(validTransition("active","completed"),true);
 assert.equal(validTransition("archived","draft"),false);
});
test("creator can submit only own drafts, managers can approve",()=>{
 assert.equal(canTransition("teacher","draft","submitted","a","a"),true);
 assert.equal(canTransition("teacher","draft","submitted","a","b"),false);
 assert.equal(canTransition("teacher","submitted","approved","a","a"),false);
 assert.equal(canTransition("owner","submitted","approved","a","b"),true);
});
