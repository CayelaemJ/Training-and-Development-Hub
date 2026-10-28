import test from "node:test";
import assert from "node:assert/strict";
import {mayChangeReport} from "../lib/reportIssuancePolicy.ts";
test("report approval always requires a second user",()=>{
 assert.equal(mayChangeReport("submitted","approve","a","a",""),false);
 assert.equal(mayChangeReport("submitted","approve","a","b",""),true);
});
test("reports cannot issue until approved or be revoked without a reason",()=>{
 assert.equal(mayChangeReport("submitted","issue","a","b",""),false);
 assert.equal(mayChangeReport("approved","issue","a","b",""),true);
 assert.equal(mayChangeReport("issued","revoke","a","b",""),false);
 assert.equal(mayChangeReport("issued","revoke","a","b","Incorrect evidence"),true);
 assert.equal(mayChangeReport("revoked","issue","a","b",""),false);
});
