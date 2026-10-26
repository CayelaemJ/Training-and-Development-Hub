import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {identifyCountryScopedSchoolRoute} from "../lib/schoolDataReleasePolicy.ts";

const source = relative => readFileSync(new URL(relative,import.meta.url),"utf8");

test("new read routes are scoped and reach the country clearance gate",()=>{
 for(const url of [
   "/organizations/3/institution-records/me",
   "/organizations/3/report-issuance/me"
 ]) assert.deepEqual(identifyCountryScopedSchoolRoute(url,undefined),{kind:"scoped",orgId:3});
});
test("legacy cross-school collection endpoints remain blocked",()=>{
 for(const url of ["/institution-records/me","/report-issuance/me"])
   assert.equal(identifyCountryScopedSchoolRoute(url,undefined).kind,"unscoped_sensitive");
});
test("self-enrolment listing enforces BOTH school and authenticated learner in query",()=>{
 const src=source("../routes/institutionRecords.ts");
 const scoped=src.slice(src.indexOf('router.get("/organizations/:orgId/institution-records/me"'),
   src.indexOf('router.get("/institution-records/me"'));
 assert.ok(scoped.length>50);
 assert.match(scoped,/eq\(verifiedEnrollmentsTable\.organizationId,org\.data\)/);
 assert.match(scoped,/eq\(verifiedEnrollmentsTable\.learnerId,user\)/);
 assert.doesNotMatch(scoped,/guardianRelationshipsTable/);
 assert.doesNotMatch(scoped,/schoolTransfersTable/);
 assert.match(scoped,/private, no-store/);
});
test("issued reports listing filters BOTH institution and learner and only issued reports",()=>{
 const src=source("../routes/reportIssuance.ts");
 const scoped=src.slice(src.indexOf('router.get("/organizations/:orgId/report-issuance/me"'),
   src.indexOf('router.get("/report-issuance/me"'));
 assert.ok(scoped.length>50);
 assert.match(scoped,/eq\(issuedSchoolReportsTable\.organizationId,org\.data\)/);
 assert.match(scoped,/eq\(issuedSchoolReportsTable\.learnerId,req\.user\.id\)/);
 assert.match(scoped,/eq\(issuedSchoolReportsTable\.status,"issued"\)/);
 assert.match(scoped,/private, no-store/);
});
