import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
const app = file("../../../../training-platform/src/App.tsx");
const hub = file("../../../../training-platform/src/pages/admissions-hub.tsx");
const portal = file("../routes/rolePortals.ts");

test("admissions hub is a real navigable route with a visible sidebar link", () => {
  assert.match(app, /import AdmissionsHubPage from ['"]@\/pages\/admissions-hub['"]/);
  assert.match(app, /<Route path="\/admissions" component=\{AdmissionsHubPage\}/);
  assert.match(app, /href: '\/admissions', label: 'Admissions & transfers'/);
  assert.match(app, /includes\('\/admissions'\)/);
});
test("student, parent, headmaster and institution administrators have admissions navigation", () => {
  for (const role of ["parent", "learner", "headmaster", "deputy_headmaster", "administrator", "superadmin"]) {
    assert.ok(app.includes(role + ":['/admissions',"), role + " missing sidebar");
    assert.ok(portal.includes(role + ':[["Admissions & transfers","/admissions"]'), role + " missing dashboard card");
  }
});
test("existing university drafts, guardian and institution records are connected rather than duplicated", () => {
  assert.match(hub, /href="\/cabo-apply"/);
  assert.match(hub, /href="\/guardian-connect"/);
  assert.match(hub, /href="\/institution-records"/);
  assert.match(hub, /href="\/organizations"/);
});
test("pilot hub provides no sensitive evidence upload or fake school-submission controls", () => {
  assert.doesNotMatch(hub, /type=["']file["']/);
  assert.doesNotMatch(hub, /new FormData\(/);
  assert.doesNotMatch(hub, /\/api\/admissions\/applications["']\s*,\s*["']POST/);
  assert.match(hub, /not available yet/);
  assert.match(hub, /Guardian-first schooling/);
  assert.match(hub, /institution.*confirm admission/i);
});
