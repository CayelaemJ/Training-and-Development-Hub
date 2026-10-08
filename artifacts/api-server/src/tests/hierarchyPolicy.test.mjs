import test from "node:test";
import assert from "node:assert/strict";
import {descendantIds, leadershipRanks, mayDelegate, managementRole, roleAllowedAtUnit} from "../lib/hierarchyPolicy.ts";
test("governance uses strict, descending delegation",()=>{
 assert.equal(mayDelegate("headmaster","teacher"),true);
 assert.equal(mayDelegate("headmaster","headmaster"),false);
 assert.equal(mayDelegate("headmaster","district_director"),false);
 assert.equal(mayDelegate("grade_head","teacher"),false);
 assert.equal(mayDelegate("district_director","headmaster"),true);
 assert.equal(mayDelegate("teacher","learner"),false);
 assert.equal(mayDelegate("national_director","provincial_director"),true);
});
test("learner/parent have no management power",()=>{
 assert.equal(managementRole("learner"),false);
 assert.equal(managementRole("parent"),false);
 assert.equal(leadershipRanks.learner,0);
});
test("delegated scope never includes siblings or their children",()=>{
 const units=[{id:1,parentId:null},{id:2,parentId:1},{id:3,parentId:1},{id:4,parentId:2},{id:5,parentId:3},{id:6,parentId:4}];
 assert.deepEqual([...descendantIds(units,2)].sort((a,b)=>a-b),[2,4,6]);
 assert.equal(descendantIds(units,2).has(5),false);
 assert.deepEqual([...descendantIds(units,4)].sort((a,b)=>a-b),[4,6]);
});

test("role appointment must match institutional level",()=>{
 assert.equal(roleAllowedAtUnit("national_director","national"),true);
 assert.equal(roleAllowedAtUnit("national_director","school"),false);
 assert.equal(roleAllowedAtUnit("district_director","school"),false);
 assert.equal(roleAllowedAtUnit("headmaster","school"),true);
 assert.equal(roleAllowedAtUnit("headmaster","district"),false);
 assert.equal(roleAllowedAtUnit("teacher","class"),true);
 assert.equal(roleAllowedAtUnit("parent","school"),false);
});
