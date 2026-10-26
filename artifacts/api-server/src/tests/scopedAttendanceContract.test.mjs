import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {identifyCountryScopedSchoolRoute} from "../lib/schoolDataReleasePolicy.ts";

test("attendance route is covered by institution release clearance",()=>{
 assert.deepEqual(identifyCountryScopedSchoolRoute("/organizations/8/attendance/me",null),
   {kind:"scoped",orgId:8});
 assert.equal(identifyCountryScopedSchoolRoute("/school/attendance/me",null).kind,
   "unscoped_sensitive");
});
test("scoped attendance binds school and signed-in learner and omits private teacher notes",()=>{
 const source=readFileSync(new URL("../routes/educationTalent.ts",import.meta.url),"utf8");
 const from=source.indexOf('router.get("/organizations/:orgId/attendance/me"');
 const to=source.indexOf('router.get("/school/attendance/me"');
 assert.ok(from>=0&&to>from);
 const scoped=source.slice(from,to);
 assert.match(scoped,/eq\(schoolAttendanceTable\.organizationId,org\.data\)/);
 assert.match(scoped,/eq\(schoolAttendanceTable\.learnerId,user\)/);
 assert.match(scoped,/day:schoolAttendanceTable\.day/);
 assert.match(scoped,/status:schoolAttendanceTable\.status/);
 assert.doesNotMatch(scoped,/note:schoolAttendanceTable\.note/);
 assert.doesNotMatch(scoped,/recordedBy:schoolAttendanceTable\.recordedBy/);
 assert.match(scoped,/private, no-store/);
});
