// Synthetic two-tenant HTTP/database tests for organization membership,
// invitations and assessment review. Bundle with @workspace/db aliased to
// supportTestDb.ts (see scripts/test-organizations.mjs). No real data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import router from "../../routes/organizations";
import { engine } from "./supportTestDb";

// Two schools, each with an owner; an outsider who creates their own org;
// learners and staff with synthetic emails.
await engine.exec(`
CREATE TABLE users(id varchar PRIMARY KEY, email varchar UNIQUE, first_name varchar, last_name varchar, profile_image_url varchar, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sessions(sid varchar PRIMARY KEY, sess jsonb NOT NULL, expire timestamp NOT NULL);
CREATE TABLE organizations(id serial PRIMARY KEY, name varchar(200) NOT NULL, owner_id varchar NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE organization_members(organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, role varchar(24) NOT NULL, joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id));
CREATE TABLE learner_groups(id serial PRIMARY KEY, organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name varchar(200) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE learner_group_members(group_id integer NOT NULL REFERENCES learner_groups(id) ON DELETE CASCADE, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(group_id,user_id));
CREATE TABLE written_exams(id serial PRIMARY KEY, user_id varchar NOT NULL, material_id integer NOT NULL, title varchar(200) NOT NULL, difficulty varchar(24) NOT NULL, questions jsonb NOT NULL, model_id varchar(100) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE written_exam_attempts(id serial PRIMARY KEY, exam_id integer NOT NULL REFERENCES written_exams(id) ON DELETE CASCADE, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, answers jsonb NOT NULL, feedback jsonb NOT NULL, awarded_marks real NOT NULL, max_marks integer NOT NULL, percentage real NOT NULL, review_required integer NOT NULL DEFAULT 0, completed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE exam_assignments(id serial PRIMARY KEY, organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, group_id integer NOT NULL REFERENCES learner_groups(id) ON DELETE CASCADE, exam_id integer NOT NULL REFERENCES written_exams(id) ON DELETE CASCADE, created_by varchar NOT NULL REFERENCES users(id), due_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE assignment_submissions(id serial PRIMARY KEY, assignment_id integer NOT NULL REFERENCES exam_assignments(id) ON DELETE CASCADE, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, attempt_id integer NOT NULL UNIQUE REFERENCES written_exam_attempts(id) ON DELETE CASCADE, submitted_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE assessor_overrides(id serial PRIMARY KEY, submission_id integer NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE, assessor_id varchar NOT NULL REFERENCES users(id), question_index integer NOT NULL, awarded_marks real NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO users(id,email,first_name,last_name) VALUES
 ('owner-a','owner.a@school-a.test','Ada','Owner'),
 ('admin-a','admin.a@school-a.test','Abe','Admin'),
 ('teacher-a','teacher.a@school-a.test','Tia','Teacher'),
 ('learner-a','learner.a@school-a.test','Lia','Learner'),
 ('owner-b','owner.b@school-b.test','Bo','Owner'),
 ('learner-b','learner.b@school-b.test','Ben','Learner'),
 ('outsider','outsider@elsewhere.test','Oz','Outsider'),
 ('victim','victim.child@family.test','Vic','Child');
INSERT INTO organizations(id,name,owner_id) VALUES (1,'Synthetic School A','owner-a'),(2,'Synthetic School B','owner-b');
SELECT setval('organizations_id_seq', 10);
INSERT INTO organization_members(organization_id,user_id,role) VALUES
 (1,'owner-a','owner'),(1,'admin-a','admin'),(1,'teacher-a','teacher'),(1,'learner-a','learner'),
 (2,'owner-b','owner'),(2,'learner-b','learner');
INSERT INTO learner_groups(id,organization_id,name) VALUES (1,1,'Grade 7 A'),(2,2,'Grade 7 B');
INSERT INTO learner_group_members VALUES (1,'learner-a'),(2,'learner-b');
INSERT INTO written_exams(id,user_id,material_id,title,difficulty,questions,model_id) VALUES
 (1,'owner-a',1,'Fractions check','medium','[{"prompt":"Q1","type":"short_answer","maxMarks":5},{"prompt":"Q2","type":"short_answer","maxMarks":5}]','synthetic'),
 (2,'owner-b',1,'Other school test','medium','[{"prompt":"Q1","type":"short_answer","maxMarks":10}]','synthetic');
INSERT INTO written_exam_attempts(id,exam_id,user_id,answers,feedback,awarded_marks,max_marks,percentage) VALUES
 (1,1,'learner-a','["a","b"]','[{"questionIndex":0,"awardedMarks":2,"maxMarks":5,"feedback":"partial","evidence":"","needsReview":true},{"questionIndex":1,"awardedMarks":4,"maxMarks":5,"feedback":"good","evidence":"","needsReview":false}]',6,10,60),
 (2,2,'learner-b','["c"]','[{"questionIndex":0,"awardedMarks":9,"maxMarks":10,"feedback":"good","evidence":"","needsReview":false}]',9,10,90);
INSERT INTO exam_assignments(id,organization_id,group_id,exam_id,created_by) VALUES (1,1,1,1,'owner-a'),(2,2,2,2,'owner-b');
INSERT INTO assignment_submissions(id,assignment_id,user_id,attempt_id) VALUES (1,1,'learner-a',1),(2,2,'learner-b',2);
`);
const migration = await readFile(process.cwd() + "/lib/db/migrations/20261122_organization_invitations.sql", "utf8");
await engine.exec(migration);

// Sessions: the victim has one session with a provider-verified email and one without.
const VERIFIED_SID = "a".repeat(64), UNVERIFIED_SID = "b".repeat(64), OTHER_SID = "c".repeat(64);
const future = "now() + interval '1 hour'";
await engine.exec(`INSERT INTO sessions VALUES
 ('${VERIFIED_SID}','{"user":{"id":"victim"},"verified_email":"victim.child@family.test"}',${future}),
 ('${UNVERIFIED_SID}','{"user":{"id":"victim"}}',${future}),
 ('${OTHER_SID}','{"user":{"id":"outsider"},"verified_email":"outsider@elsewhere.test"}',${future});`);

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = req.headers["x-test-user"] ? ({ id: String(req.headers["x-test-user"]) } as any) : undefined;
  req.isAuthenticated = (() => !!req.user) as any;
  next();
});
app.use("/api", router);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(r => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
async function call(user: string, path: string, opts: { method?: string; body?: unknown; sid?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (user) headers["x-test-user"] = user;
  if (opts.sid) headers.authorization = `Bearer ${opts.sid}`;
  const res = await fetch(base + path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"), headers,
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const membersOf = async (org: number) =>
  (await engine.query<{ user_id: string; role: string }>("SELECT user_id, role FROM organization_members WHERE organization_id=$1 ORDER BY user_id", [org])).rows;

let failures = 0, passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`ok - ${name}`); }
  catch (e) { failures++; console.log(`not ok - ${name}`); console.log(e); }
}

try {
  await check("unauthenticated requests are rejected", async () => {
    assert.equal((await call("", "/organizations/1/members")).status, 401);
    assert.equal((await call("", "/organization-invitations")).status, 401);
    assert.equal((await call("", "/my-assignment-results")).status, 401);
  });

  // --- F-2026-11-22-01: the attack chain from main no longer works ---------
  let outsiderOrg = 0;
  await check("an outsider can create an organization (unchanged)", async () => {
    const r = await call("outsider", "/organizations", { body: { name: "Not a real school" } });
    assert.equal(r.status, 201);
    outsiderOrg = r.data.id;
  });
  await check("inviting a registered and an unknown email gives identical responses", async () => {
    const known = await call("outsider", `/organizations/${outsiderOrg}/members`, { body: { email: "Victim.Child@family.test", role: "learner" } });
    const unknown = await call("outsider", `/organizations/${outsiderOrg}/members`, { body: { email: "nobody@nowhere.test", role: "learner" } });
    assert.equal(known.status, 202);
    assert.deepEqual(known, unknown);
    assert.doesNotMatch(JSON.stringify(known.data), /victim|userId/i);
  });
  await check("the invited person is NOT a member and their name is not disclosed", async () => {
    assert.deepEqual((await membersOf(outsiderOrg)).map(m => m.user_id), ["outsider"]);
    const list = await call("outsider", `/organizations/${outsiderOrg}/members`);
    assert.equal(list.status, 200);
    assert.doesNotMatch(JSON.stringify(list.data), /Vic|victim/i);
    const pending = await call("outsider", `/organizations/${outsiderOrg}/invitations`);
    assert.deepEqual(pending.data.map((i: any) => i.email).sort(), ["nobody@nowhere.test", "victim.child@family.test"]);
    assert.ok(pending.data.every((i: any) => !("firstName" in i) && !("userId" in i)));
  });

  // --- Invitee consent and verified email -----------------------------------
  let invitationId = 0;
  await check("without a provider-verified email the invitee sees no invitations", async () => {
    const r = await call("victim", "/organization-invitations", { sid: UNVERIFIED_SID });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, []);
  });
  await check("with a verified email the invitee sees the organization name and role only", async () => {
    const r = await call("victim", "/organization-invitations", { sid: VERIFIED_SID });
    assert.equal(r.data.length, 1);
    assert.equal(r.data[0].organization, "Not a real school");
    assert.equal(r.data[0].role, "learner");
    assert.ok(!("invitedBy" in r.data[0]));
    invitationId = r.data[0].id;
  });
  await check("nobody else can answer the invitation, and unverified sessions cannot either", async () => {
    assert.equal((await call("outsider", `/organization-invitations/${invitationId}/decision`, { sid: OTHER_SID, body: { decision: "accepted" } })).status, 404);
    assert.equal((await call("victim", `/organization-invitations/${invitationId}/decision`, { sid: UNVERIFIED_SID, body: { decision: "accepted" } })).status, 404);
    assert.equal((await call("victim", `/organization-invitations/${invitationId}/decision`, { sid: OTHER_SID, body: { decision: "accepted" } })).status, 404, "session of another user");
    assert.deepEqual((await membersOf(outsiderOrg)).map(m => m.user_id), ["outsider"]);
  });
  await check("declining creates no membership and cannot be reversed", async () => {
    const r = await call("victim", `/organization-invitations/${invitationId}/decision`, { sid: VERIFIED_SID, body: { decision: "declined" } });
    assert.equal(r.status, 200);
    assert.equal((await call("victim", `/organization-invitations/${invitationId}/decision`, { sid: VERIFIED_SID, body: { decision: "accepted" } })).status, 404);
    assert.deepEqual((await membersOf(outsiderOrg)).map(m => m.user_id), ["outsider"]);
  });

  // --- Legitimate school flow and role limits ----------------------------
  await check("admins cannot invite admins; teachers and learners cannot invite at all", async () => {
    assert.equal((await call("admin-a", "/organizations/1/members", { body: { email: "new.admin@school-a.test", role: "admin" } })).status, 403);
    assert.equal((await call("teacher-a", "/organizations/1/members", { body: { email: "x@school-a.test", role: "learner" } })).status, 403);
    assert.equal((await call("learner-a", "/organizations/1/members", { body: { email: "x@school-a.test", role: "learner" } })).status, 403);
    assert.equal((await call("owner-a", "/organizations/1/members", { body: { email: "x@school-a.test", role: "owner" } })).status, 400);
  });
  await check("an accepted invitation creates exactly one membership with the invited role", async () => {
    assert.equal((await call("admin-a", "/organizations/1/members", { body: { email: "victim.child@family.test", role: "learner" } })).status, 202);
    const inbox = await call("victim", "/organization-invitations", { sid: VERIFIED_SID });
    assert.equal(inbox.data.length, 1);
    assert.equal((await call("victim", `/organization-invitations/${inbox.data[0].id}/decision`, { sid: VERIFIED_SID, body: { decision: "accepted" } })).status, 200);
    assert.deepEqual((await membersOf(1)).find(m => m.user_id === "victim"), { user_id: "victim", role: "learner" });
    assert.equal((await call("admin-a", "/organizations/1/members", { body: { email: "victim.child@family.test", role: "learner" } })).status, 409);
  });
  await check("an expired invitation is renewed when sent again", async () => {
    await call("owner-a", "/organizations/1/members", { body: { email: "late@school-a.test", role: "learner" } });
    await engine.exec("UPDATE organization_invitations SET created_at=now()-interval '20 days', expires_at=now()-interval '6 days' WHERE email='late@school-a.test'");
    assert.equal((await call("owner-a", "/organizations/1/invitations")).data.find((i: any) => i.email === "late@school-a.test").expired, true);
    assert.equal((await call("owner-a", "/organizations/1/members", { body: { email: "late@school-a.test", role: "teacher" } })).status, 202);
    const row = (await engine.query<{ role: string; live: boolean; n: number }>("SELECT role, expires_at > now() AS live, count(*) OVER ()::int AS n FROM organization_invitations WHERE email='late@school-a.test' AND status='pending'")).rows;
    assert.deepEqual(row, [{ role: "teacher", live: true, n: 1 }]);
  });

  // --- Cross-tenant isolation ------------------------------------------------
  await check("school A managers cannot read or change school B", async () => {
    for (const path of ["/organizations/2/members", "/organizations/2/invitations", "/organizations/2/submissions", "/organizations/2/dashboard"]) {
      assert.equal((await call("owner-a", path)).status, 403, path);
    }
    assert.equal((await call("owner-a", "/organizations/2/members", { body: { email: "z@school-b.test", role: "learner" } })).status, 403);
    assert.equal((await call("owner-a", "/organizations/2/submissions/2/overrides", { body: { questionIndex: 0, awardedMarks: 1, reason: "cross-tenant attempt" } })).status, 403);
    await call("owner-b", "/organizations/2/members", { body: { email: "b.invite@school-b.test", role: "learner" } });
    const bInvite = (await engine.query<{ id: number }>("SELECT id FROM organization_invitations WHERE organization_id=2")).rows[0].id;
    assert.equal((await call("owner-a", `/organizations/1/invitations/${bInvite}`, { method: "DELETE" })).status, 404, "cannot revoke another school's invitation via own org id");
    assert.equal((await call("owner-a", `/organizations/2/invitations/${bInvite}`, { method: "DELETE" })).status, 403);
  });
  await check("an override cannot target another school's submission through one's own organization", async () => {
    assert.equal((await call("owner-a", "/organizations/1/submissions/2/overrides", { body: { questionIndex: 0, awardedMarks: 1, reason: "wrong tenant" } })).status, 400);
    assert.equal(Number((await engine.query<{ n: number }>("SELECT count(*) AS n FROM assessor_overrides")).rows[0].n), 0);
  });

  // --- P1-08 effective scores -------------------------------------------------
  await check("an assessor override changes the effective score and leaves AI marks intact", async () => {
    assert.equal((await call("owner-a", "/organizations/1/submissions/1/overrides", { body: { questionIndex: 0, awardedMarks: 5, reason: "Rubric point missed by AI" } })).status, 201);
    const list = await call("owner-a", "/organizations/1/submissions");
    const s = list.data.find((x: any) => x.id === 1);
    assert.equal(s.percentage, 60);
    assert.equal(s.effectivePercentage, 90);
    assert.equal(s.reviewStatus, "assessor_adjusted");
    assert.ok(list.data.every((x: any) => x.id !== 2), "other school's submission not listed");
    const dash = await call("owner-a", "/organizations/1/dashboard");
    assert.equal(dash.data.averageAiScore, 60);
    assert.equal(dash.data.averageEffectiveScore, 90);
    assert.equal(dash.data.assessorAdjustedSubmissions, 1);
    const attempt = (await engine.query<{ awarded_marks: number }>("SELECT awarded_marks FROM written_exam_attempts WHERE id=1")).rows[0];
    assert.equal(attempt.awarded_marks, 6);
  });
  await check("learners see only their own reviewed results, without assessor identity", async () => {
    const a = await call("learner-a", "/my-assignment-results");
    assert.equal(a.status, 200);
    assert.equal(a.data.length, 1);
    assert.equal(a.data[0].effectivePercentage, 90);
    assert.equal(a.data[0].questions[0].reviewReason, "Rubric point missed by AI");
    assert.doesNotMatch(JSON.stringify(a.data), /owner-a|assessorId|"answers"/);
    const b = await call("learner-b", "/my-assignment-results");
    assert.equal(b.data.length, 1);
    assert.equal(b.data[0].reviewStatus, "ai_provisional");
    assert.deepEqual((await call("outsider", "/my-assignment-results")).data, []);
  });
} finally {
  server.close();
  await engine.close();
}
console.log(`# organizations integration: ${passed} passed, ${failures} failed`);
if (failures > 0) process.exitCode = 1;
