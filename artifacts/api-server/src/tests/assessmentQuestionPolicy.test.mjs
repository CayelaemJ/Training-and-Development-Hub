import test from "node:test";import assert from "node:assert/strict";
import {questionActionAllowed} from "../lib/assessmentQuestionPolicy.ts";
test("creator cannot approve their own assessment item",()=>{assert.equal(questionActionAllowed("submitted","approve","a","a","owner",""),false);assert.equal(questionActionAllowed("submitted","approve","a","b","owner",""),true);assert.equal(questionActionAllowed("submitted","approve","a","b","teacher",""),false)});
test("no item can be published without independent review",()=>{assert.equal(questionActionAllowed("draft","publish","a","b","owner",""),false);assert.equal(questionActionAllowed("submitted","publish","a","b","owner",""),false);assert.equal(questionActionAllowed("approved","publish","a","b","owner",""),true)});
