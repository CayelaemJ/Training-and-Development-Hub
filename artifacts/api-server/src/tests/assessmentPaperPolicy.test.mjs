import test from "node:test";
import assert from "node:assert/strict";
import {canChangePaper} from "../lib/assessmentPaperPolicy.ts";
test("the creator may submit but cannot approve their own paper",()=>{
 assert.equal(canChangePaper("draft","submit","teacher","teacher",false,""),true);
 assert.equal(canChangePaper("submitted","approve","teacher","teacher",true,""),false);
 assert.equal(canChangePaper("submitted","approve","teacher","principal",true,""),true);
 assert.equal(canChangePaper("submitted","approve","teacher","other-teacher",false,""),false);
});
test("a moderated paper publishes only after approval; rejection requires explanation",()=>{
 assert.equal(canChangePaper("draft","publish","teacher","principal",true,""),false);
 assert.equal(canChangePaper("approved","publish","teacher","principal",true,""),true);
 assert.equal(canChangePaper("submitted","reject","teacher","principal",true,""),false);
 assert.equal(canChangePaper("submitted","reject","teacher","principal",true,"Incorrect content"),true);
});
