import test from "node:test";
import assert from "node:assert/strict";
import {draftPlanTemplate} from "../lib/planFallback.ts";
test("non-AI development plan fallback remains transparent and actionable",()=>{
 const p=draftPlanTemplate({goal:"Improve reading fluency",periodWeeks:2,observations:[{area:"academic",activity:"Reading",currentLevel:"Developing",strengths:"Comprehension",focus:"Fluency"}]});
 assert.match(p.title,/template/i);assert.equal(p.recommendations.length,1);
 assert.equal(p.recommendations[0].reviewWeek,2);
 assert.ok(p.recommendations[0].steps.length>=2);
 assert.match(p.coachOrTeacherReview,/teacher/i);
});
