import test from "node:test";
import assert from "node:assert/strict";
import {schoolPhases,phaseForGrade,validPhaseDomain,mayWriteSchoolProgress} from "../lib/schoolStagePolicy.ts";
test("each SA school grade belongs to exactly one school phase",()=>{
 const grades=Object.values(schoolPhases).flatMap(x=>[...x.grades]);
 assert.equal(new Set(grades).size,grades.length);
 assert.equal(phaseForGrade("RR"),"preprimary");
 assert.equal(phaseForGrade("R"),"preprimary");
 assert.equal(phaseForGrade("7"),"primary");
 assert.equal(phaseForGrade("8"),"highschool");
 assert.equal(phaseForGrade("12"),"highschool");
 assert.equal(phaseForGrade("university"),null);
});
test("developmental domains cannot be used across stages",()=>{
 assert.equal(validPhaseDomain("preprimary","motor_development"),true);
 assert.equal(validPhaseDomain("highschool","motor_development"),false);
 assert.equal(validPhaseDomain("highschool","subject_mastery"),true);
 assert.equal(validPhaseDomain("primary","literacy"),true);
});
test("learner and teacher cannot create private institution-wide records",()=>{
 assert.equal(mayWriteSchoolProgress("owner"),true);
 assert.equal(mayWriteSchoolProgress("admin"),true);
 assert.equal(mayWriteSchoolProgress("teacher"),false);
 assert.equal(mayWriteSchoolProgress("learner"),false);
});
