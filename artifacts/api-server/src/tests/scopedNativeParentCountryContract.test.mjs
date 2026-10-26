import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {identifyCountryScopedSchoolRoute} from "../lib/schoolDataReleasePolicy.ts";
const src=readFileSync(new URL("../routes/nativeParent.ts",import.meta.url),"utf8");

test("school-scoped native routes require the server-side country release gate",()=>{
 for(const route of [
  "/organizations/5/native/mobile/parent",
  "/organizations/5/native/mobile/parent/reports",
  "/ORGANIZATIONS/5/NATIVE/MOBILE/PARENT/REPORTS/"
 ]) assert.deepEqual(identifyCountryScopedSchoolRoute(route,undefined),{kind:"scoped",orgId:5});
 assert.equal(identifyCountryScopedSchoolRoute("/native/mobile/parent",undefined).kind,"unscoped_sensitive");
 assert.equal(identifyCountryScopedSchoolRoute("/native/mobile/parent/reports",undefined).kind,"unscoped_sensitive");
});
test("native parents cannot use another school's clearance to aggregate children",()=>{
 assert.match(src,/router\.get\("\/organizations\/:orgId\/native\/mobile\/parent",parentOverview\)/);
 assert.match(src,/router\.get\("\/organizations\/:orgId\/native\/mobile\/parent\/reports",parentReports\)/);
 assert.match(src,/selectedOrg=req\.params\.orgId===undefined/);
 assert.match(src,/eq\(verifiedEnrollmentsTable\.organizationId,selectedOrg\.data\)/);
 assert.match(src,/relationships\.filter\(r=>approvedIds\.has\(r\.learnerId\)\)/);
 assert.match(src,/\.orderBy\(desc\(guardianVerificationEventsTable\.createdAt\),/);
});
test("native parent identity still requires bearer sign-in and purpose-built native session",()=>{
 assert.match(src,/authorization\?\.startsWith\("Bearer "\)/);
 assert.match(src,/session\?\.access_token !== "cabo-native-session-v1"/);
 assert.match(src,/canReadChildReport\("verified", event\?\.decision === "verified", true\)/);
});
