import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("artifacts/api-server/src/routes/organizations.ts", "utf8");
const page = readFileSync("artifacts/training-platform/src/pages/learner-success.tsx", "utf8");
const support = readFileSync("artifacts/api-server/src/routes/learnerSupport.ts", "utf8");

test("the platform-wide school list marks schools the administrator is not a member of", () => {
  assert.match(route, /member:mine\.has\(o\.id\)/);
});

test("the success loop only offers schools the account belongs to and explains when there are none", () => {
  assert.match(page, /filter\(\(o\) => o\.member !== false\)/);
  assert.match(page, /setOrg\(String\(memberOrgs\[0\]\.id\)\)/);
  assert.doesNotMatch(page, /setOrg\(String\(orgs\.data\[0\]\.id\)\)/, "never default to a platform-only school");
  assert.match(page, /this account is not a member of one/);
});

test("learner support still requires school membership (no superadmin bypass)", () => {
  assert.doesNotMatch(support, /isPlatformSuperadmin/);
  assert.match(support, /const r = await role\(org\.data, req\.user!\.id\);\s*if \(!r\) \{\s*res\.sendStatus\(403\);/);
});
