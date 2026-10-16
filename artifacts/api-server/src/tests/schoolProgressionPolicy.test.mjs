import test from "node:test";
import assert from "node:assert/strict";
import {schoolGrades,nextSchoolGrade,canProgressToYear} from "../lib/schoolProgressionPolicy.ts";
test("Grade RR–12 transitions are sequential and never skip a grade",()=>{
 assert.equal(schoolGrades.length,14);
 assert.equal(new Set(schoolGrades).size,14);
 for(let i=0;i<schoolGrades.length-1;i++)assert.equal(nextSchoolGrade(schoolGrades[i]),schoolGrades[i+1]);
 assert.equal(nextSchoolGrade("12"),null);
 assert.equal(nextSchoolGrade("university"),null);
});
test("year-end promotion accepts only the immediately following year",()=>{
 assert.equal(canProgressToYear(2026,2027),true);
 assert.equal(canProgressToYear(2026,2028),false);
 assert.equal(canProgressToYear(2026,2026),false);
 assert.equal(canProgressToYear(2026.5,2027.5),false);
});
