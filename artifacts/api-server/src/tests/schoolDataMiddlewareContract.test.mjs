import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

function source(relative) {return readFileSync(new URL(relative,import.meta.url),"utf8");}

test("country release middleware executes before route handlers",()=>{
 const app=source("../app.ts");
 assert.match(app,/CABO_COUNTRY_PILOT_ENFORCEMENT === "true"/);
 assert.match(app,/app\.use\("\/api", schoolDataReleaseMiddleware\);/);
 assert.ok(app.indexOf('app.use("/api", schoolDataReleaseMiddleware);')<
   app.indexOf('app.use("/api", router);'));
});
test("no school can self-approve its release from the institution setup route",()=>{
 const school=source("../routes/institutionSetup.ts");
 assert.doesNotMatch(school,/institutionDataClearancesTable/);
 assert.doesNotMatch(school,/school_data_clearance.*approved/i);
});
test("data gate is fail-closed for unresolved school, old schema and unscoped routes",()=>{
 const policy=source("../middlewares/schoolDataRelease.ts");
 assert.match(policy,/assessSchoolDataRelease\(record \?\? null\)/);
 assert.match(policy,/route\.kind === "unscoped_sensitive"/);
 assert.match(policy,/res\.status\(503\)/);
 assert.match(policy,/res\.status\(409\)/);
});
test("new migrations create no approved school data records",()=>{
 const sql=source("../../../../lib/db/migrations/20261026_institution_data_clearance.sql");
 assert.match(sql,/DEFAULT 'blocked'/);
 assert.doesNotMatch(sql,/INSERT INTO institution_data_clearances/i);
});

test("role portal hides personal cross-school learner and guardian counts under strict country enforcement",()=>{
 const portal=source("../routes/rolePortals.ts");
 const guarded=portal.indexOf('if(process.env.CABO_COUNTRY_PILOT_ENFORCEMENT==="true")');
 const personal=portal.indexOf('.from(learnerJourneysTable)');
 assert.ok(guarded>=0,"must gate portal response");
 assert.ok(personal>guarded,"personal count query must occur only after the strict-mode early return");
 assert.match(portal,/countryScopedRecordsRequired:true/);
});
