// Synthetic HTTP/database tests for learner-approved passport sharing.
// Database generated from the real Drizzle schema. Bundle with @workspace/db
// aliased to supportTestDb.ts (see scripts/test-passport-shares.mjs).
import assert from "node:assert/strict";
import express from "express";
import passportSharesRouter from "../../routes/passportShares";
import { engine } from "./supportTestDb";
import { createSchemaFromDrizzle, syncSequences } from "./schemaFromDrizzle";

Object.assign(process.env, { CABO_ENVIRONMENT: "testing", CABO_TEST_DATABASE_ISOLATED: "true" });
await createSchemaFromDrizzle();

// school 1 (learner-minor with verified guardian g-ok; learner-adult without),
// university 2 (uni-admin owner, uni-lecturer teacher), employer 3 (emp-admin),
// school 4 (school4-head) is not a recipient.
await engine.exec(`
INSERT INTO users(id,email,first_name,last_name) VALUES
 ('school-head','h@s1.test','Hana','Head'),('learner-minor','m@s1.test','Lerato','Minor'),('learner-adult','a@s1.test','Ayanda','Adult'),
 ('g-ok','g@family.test','Grace','Guardian'),('g-pending','gp@family.test','Pat','Pending'),
 ('uni-admin','ua@uni.test','Una','Admin'),('uni-lecturer','ul@uni.test','Lee','Lecturer'),
 ('emp-admin','ea@emp.test','Emma','Employer'),('school4-head','h4@s4.test','Sam','School'),('stranger','x@nowhere.test','Xan','Stranger');
INSERT INTO organizations(id,name,owner_id) VALUES (1,'School One','school-head'),(2,'Uni Two','uni-admin'),(3,'Employer Three','emp-admin'),(4,'School Four','school4-head');
INSERT INTO academic_settings(organization_id,institution_type,framework,academic_year) VALUES (1,'school','NSC',2026),(2,'university','UNIVERSITY',2026),(4,'school','IEB',2026);
INSERT INTO organization_members(organization_id,user_id,role) VALUES
 (1,'school-head','owner'),(1,'learner-minor','learner'),(1,'learner-adult','learner'),
 (2,'uni-admin','owner'),(2,'uni-lecturer','teacher'),(3,'emp-admin','owner'),(4,'school4-head','owner');
INSERT INTO guardian_relationships(id,learner_id,guardian_id,status) VALUES (1,'learner-minor','g-ok','verified'),(2,'learner-minor','g-pending','pending');
INSERT INTO academic_courses(id,organization_id,name,code,level) VALUES (1,1,'Mathematics','MAT12','Grade 12');
INSERT INTO academic_periods(id,organization_id,name,year,begins_at) VALUES (1,1,'Term 1',2026,'2026-01-14');
INSERT INTO academic_assessments(id,organization_id,course_id,period_id,title,category,max_marks,weight,created_by) VALUES
 (1,1,1,1,'Test 1','test',50,1,'school-head'),(2,1,1,1,'Test 2','test',100,1,'school-head');
INSERT INTO academic_grades(assessment_id,learner_id,marks,status,reviewed_by,updated_at) VALUES
 (1,'learner-minor',40,'published','school-head',now()),(2,'learner-minor',70,'published','school-head',now()),
 (1,'learner-adult',10,'draft','school-head',now());
INSERT INTO passport_competencies(id,user_id,skill,category,mastery_level,demonstration,description) VALUES
 (1,'learner-adult','Python','technical',3,'project','Built a school timetable tool.');
`);
await syncSequences(["organizations", "academic_courses", "academic_periods", "academic_assessments", "guardian_relationships", "passport_competencies"]);

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = req.headers["x-test-user"] ? ({ id: String(req.headers["x-test-user"]) } as any) : undefined;
  req.isAuthenticated = (() => !!req.user) as any;
  next();
});
app.use("/api", passportSharesRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(r => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
async function call(user: string | null, method: string, path: string, body?: unknown) {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) as any };
}

let failures = 0;
async function t(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log(`ok - ${name}`); } catch (e) { failures++; console.log(`not ok - ${name}`); console.log(e); }
}

await t("sign-in is required", async () => {
  assert.equal((await call(null, "GET", "/passport-shares/me")).status, 401);
  assert.equal((await call(null, "GET", "/organizations/2/shared-passports")).status, 401);
});

await t("recipients are universities and employers, never schools", async () => {
  const r = await call("learner-adult", "GET", "/passport-shares/recipients");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((o: any) => o.id).sort(), [2, 3]);
  const toSchool = await call("learner-adult", "POST", "/passport-shares", { organizationId: 4, purpose: "admission", scope: ["results"], days: 30 });
  assert.equal(toSchool.status, 404);
});

await t("malformed requests are refused", async () => {
  for (const body of [{}, { organizationId: 2, purpose: "spying", scope: ["results"] }, { organizationId: 2, purpose: "admission", scope: [] },
    { organizationId: 2, purpose: "admission", scope: ["results", "medical"] }, { organizationId: 2, purpose: "admission", scope: ["results"], days: 3 },
    { organizationId: 2, purpose: "admission", scope: ["results"], days: 400 }])
    assert.equal((await call("learner-adult", "POST", "/passport-shares", body)).status, 400, JSON.stringify(body));
});

let adultShare = 0, minorShare = 0;
await t("an adult learner's share is active at once; nothing is visible before sharing", async () => {
  assert.deepEqual((await call("emp-admin", "GET", "/organizations/3/shared-passports")).body, []);
  const r = await call("learner-adult", "POST", "/passport-shares", { organizationId: 3, purpose: "employment", scope: ["skills"], days: 30 });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, "active");
  adultShare = r.body.id;
});

await t("a learner with a verified guardian needs that guardian's approval", async () => {
  const r = await call("learner-minor", "POST", "/passport-shares", { organizationId: 2, purpose: "admission", scope: ["results", "learning_dna"] });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, "pending_guardian");
  minorShare = r.body.id;
  assert.deepEqual((await call("uni-admin", "GET", "/organizations/2/shared-passports")).body, [], "pending shares are invisible to the recipient");
  assert.equal((await call("uni-admin", "GET", `/organizations/2/shared-passports/${minorShare}`)).status, 404);
  assert.equal((await call("g-pending", "POST", `/passport-shares/${minorShare}/guardian-decision`, { decision: "approve" })).status, 404, "unverified guardian");
  assert.equal((await call("stranger", "POST", `/passport-shares/${minorShare}/guardian-decision`, { decision: "approve" })).status, 404);
  assert.equal((await call("learner-minor", "POST", `/passport-shares/${minorShare}/guardian-decision`, { decision: "approve" })).status, 404, "the learner cannot approve their own share");
  const pending = await call("g-ok", "GET", "/passport-shares/guardian/pending");
  assert.equal(pending.body.length, 1);
  assert.equal((await call("g-ok", "POST", `/passport-shares/${minorShare}/guardian-decision`, { decision: "approve" })).status, 200);
});

await t("recipient staff see only their own institution's active shares, and only the chosen sections", async () => {
  const list = await call("uni-admin", "GET", "/organizations/2/shared-passports");
  assert.equal(list.body.length, 1);
  const view = await call("uni-admin", "GET", `/organizations/2/shared-passports/${minorShare}`);
  assert.equal(view.status, 200);
  assert.deepEqual(Object.keys(view.body.sections).sort(), ["learning_dna", "results"]);
  assert.equal(view.body.sections.results[0].pct, 75, "average of 40/50 and 70/100, published only");
  assert.equal(view.body.sections.skills, undefined);
  assert.equal((await call("uni-lecturer", "GET", `/organizations/2/shared-passports/${minorShare}`)).status, 404, "teachers at the recipient cannot open shares");
  assert.equal((await call("emp-admin", "GET", `/organizations/3/shared-passports/${minorShare}`)).status, 404, "another institution cannot open it");
  assert.equal((await call("emp-admin", "GET", `/organizations/2/shared-passports/${minorShare}`)).status, 404, "a non-member cannot open it via the right institution id");
  assert.equal((await call("emp-admin", "GET", "/organizations/2/shared-passports")).status, 403);
  assert.equal((await call("school-head", "GET", `/organizations/2/shared-passports/${minorShare}`)).status, 404, "the learner's own school cannot read it here");
  const emp = await call("emp-admin", "GET", `/organizations/3/shared-passports/${adultShare}`);
  assert.deepEqual(Object.keys(emp.body.sections), ["skills"]);
  assert.equal(emp.body.sections.skills[0].skill, "Python");
});

await t("the learner sees each view, and revoking ends access at once", async () => {
  const mine = await call("learner-minor", "GET", "/passport-shares/me");
  assert.equal(mine.body.shares[0].views, 1);
  assert.equal((await call("learner-adult", "POST", `/passport-shares/${minorShare}/revoke`)).status, 404, "only the owner can revoke");
  assert.equal((await call("learner-minor", "POST", `/passport-shares/${minorShare}/revoke`)).status, 200);
  assert.equal((await call("uni-admin", "GET", `/organizations/2/shared-passports/${minorShare}`)).status, 404);
  assert.deepEqual((await call("uni-admin", "GET", "/organizations/2/shared-passports")).body, []);
});

await t("expired shares stop working", async () => {
  await engine.exec(`UPDATE passport_shares SET expires_at = now() - interval '1 minute' WHERE id = ${adultShare}`);
  assert.equal((await call("emp-admin", "GET", `/organizations/3/shared-passports/${adultShare}`)).status, 404);
  const mine = await call("learner-adult", "GET", "/passport-shares/me");
  assert.equal(mine.body.shares[0].status, "expired");
});

await t("creation is throttled per learner", async () => {
  let last = 0;
  for (let i = 0; i < 11; i++) last = (await call("learner-adult", "POST", "/passport-shares", { organizationId: 3, purpose: "internship", scope: ["skills"], days: 30 })).status;
  assert.ok(last === 429 || last === 409, `got ${last}`);
});

await t("the feature is off unless enabled", async () => {
  const saved = process.env.CABO_TEST_DATABASE_ISOLATED;
  process.env.CABO_TEST_DATABASE_ISOLATED = "false";
  assert.equal((await call("learner-adult", "GET", "/passport-shares/me")).status, 404);
  process.env.CABO_TEST_DATABASE_ISOLATED = saved;
});

server.close();
await engine.close();
if (failures) process.exitCode = 1;
