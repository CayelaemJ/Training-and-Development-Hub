import test from "node:test";
import assert from "node:assert/strict";
import {canHumanVerify,decisionAllowed,PASSPORT_AI_DISCLOSURE,humanReviewPilotEnabled} from "../lib/passportTrustPolicy.ts";
test("AI interpretation never claims verification",()=>{
 assert.match(PASSPORT_AI_DISCLOSURE,/not evidence/i);
 assert.match(PASSPORT_AI_DISCLOSURE,/not.*verified achievement/i);
});
test("institution assessor or admin only, never self-verification",()=>{
 for(const role of ["owner","admin","assessor"])assert.equal(canHumanVerify(role,"staff","learner"),true);
 for(const role of ["learner","teacher","parent",undefined])assert.equal(canHumanVerify(role,"staff","learner"),false);
 assert.equal(canHumanVerify("owner","same","same"),false);
});
test("verified state requires a separate human decision",()=>{
 assert.equal(decisionAllowed("pending","verified"),true);
 assert.equal(decisionAllowed("pending","rejected"),true);
 assert.equal(decisionAllowed("pending","revoked"),false);
 assert.equal(decisionAllowed("verified","verified"),false);
 assert.equal(decisionAllowed("verified","revoked"),true);
 assert.equal(decisionAllowed("rejected","verified"),false);
 assert.equal(decisionAllowed("revoked","verified"),false);
});

test("human institutional verification pilot defaults off until all three conditions pass",()=>{
 assert.equal(humanReviewPilotEnabled({}),false);
 assert.equal(humanReviewPilotEnabled({ENABLE_PASSPORT_HUMAN_REVIEW_PILOT:"true"}),false);
 assert.equal(humanReviewPilotEnabled({ENABLE_PASSPORT_HUMAN_REVIEW_PILOT:"true",PASSPORT_INSTITUTION_VERIFICATION_READY:"true"}),false);
 assert.equal(humanReviewPilotEnabled({ENABLE_PASSPORT_HUMAN_REVIEW_PILOT:"true",PASSPORT_INSTITUTION_VERIFICATION_READY:"true",PASSPORT_LEARNER_CONSENT_READY:"true"}),true);
});
