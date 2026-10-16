import test from "node:test";
import assert from "node:assert/strict";
import {admissionTransitionAllowed,learnerMayTransition} from "../lib/admissionsPolicy.ts";
test("external university submission cannot be asserted directly from a draft",()=>{
 assert.equal(admissionTransitionAllowed("draft","external_submission_recorded"),false);
 assert.equal(admissionTransitionAllowed("draft","ready_for_handoff"),true);
 assert.equal(admissionTransitionAllowed("ready_for_handoff","external_submission_recorded"),true);
});
test("only authorised transitions are available to candidates",()=>{
 assert.equal(learnerMayTransition("under_review","offer"),false);
 assert.equal(learnerMayTransition("offer","accepted"),true);
 assert.equal(learnerMayTransition("draft","withdrawn"),true);
 assert.equal(learnerMayTransition("external_submission_recorded","under_review"),false);
});
