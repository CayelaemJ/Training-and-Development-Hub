// Synthetic two-school HTTP/database tests for academic records, report cards,
// guardian report access and learner-initiated request gates. The database is
// generated from the real Drizzle schema (drizzle-kit API) so it cannot drift
// from production tables. Bundle with @workspace/db aliased to supportTestDb.ts
// (see scripts/test-academic-records.mjs). No real data.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import express from "express";
import * as schema from "../../../../../lib/db/src/schema";
import academicRouter from "../../routes/academic";
import reportCardsRouter from "../../routes/reportCards";
import institutionRecordsRouter from "../../routes/institutionRecords";
import { engine } from "./supportTestDb";

const kit = createRequire(process.cwd() + "/lib/db/package.json")("drizzle-kit/api");
const statements: string[] = await kit.generateMigration(kit.generateDrizzleJson({}), kit.generateDrizzleJson(schema as Record<string, unknown>));
// drizzle-kit emits foreign keys before indexes, but a composite foreign key
// (e.g. ml_eval -> ml_model_versions(id, organization_id)) needs its unique
// index to exist first. Apply tables, then indexes, then foreign keys.
const isForeignKey = (s: string) => /FOREIGN KEY/i.test(s);
const isIndex = (s: string) => /^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(s);
const ordered = [...statements.filter(s => !isForeignKey(s) && !isIndex(s)), ...statements.filter(isIndex), ...statements.filter(isForeignKey)];
for (const statement of ordered) await engine.exec(statement);
console.log(`# schema: ${statements.length} statements generated from lib/db/src/schema`);

// School 1 and school 2. teacher-1 teaches Mathematics at school 1; teacher-1b
// is a school 1 teacher NOT assigned to Mathematics. Guardians:
//  g-ok      verified relationship + school 1 verification + active enrolment
//  g-pending relationship never verified
//  g-other   verified relationship, verification recorded only at school 2
//  g-revoked verified at school 1, then a later "revoked" decision
await engine.exec(`
INSERT INTO users(id,email,first_name,last_name) VALUES
 ('owner-1','owner1@school1.test','One','Owner'),('admin-1','admin1@school1.test','One','Admin'),
 ('teacher-1','teacher1@school1.test','Tess','Teacher'),('teacher-1b','teacher1b@school1.test','Ted','Other'),
 ('learner-1','learner1@school1.test','Lerato','Learner'),('learner-1b','learner1b@school1.test','Lindo','Learner'),
 ('owner-2','owner2@school2.test','Two','Owner'),('teacher-2','teacher2@school2.test','Thabo','Teacher'),
 ('learner-2','learner2@school2.test','Kagiso','Learner'),
 ('g-ok','g.ok@family.test','Grace','Guardian'),('g-pending','g.pending@family.test','Pat','Pending'),
 ('g-other','g.other@family.test','Otto','Other'),('g-revoked','g.revoked@family.test','Rae','Revoked'),
 ('stranger','stranger@nowhere.test','Sam','Stranger');
INSERT INTO organizations(id,name,owner_id) VALUES (1,'Synthetic School 1','owner-1'),(2,'Synthetic School 2','owner-2');
INSERT INTO organization_members(organization_id,user_id,role) VALUES
 (1,'owner-1','owner'),(1,'admin-1','admin'),(1,'teacher-1','teacher'),(1,'teacher-1b','teacher'),
 (1,'learner-1','learner'),(1,'learner-1b','learner'),
 (2,'owner-2','owner'),(2,'teacher-2','teacher'),(2,'learner-2','learner');
INSERT INTO academic_courses(id,organization_id,name,code,level) VALUES (1,1,'Mathematics','MATH7','Grade 7'),(2,2,'Mathematics','MATH7','Grade 7');
INSERT INTO academic_periods(id,organization_id,name,year) VALUES (1,1,'Term 1',2026),(2,2,'Term 1',2026);
INSERT INTO academic_enrollments(course_id,user_id) VALUES (1,'learner-1'),(1,'learner-1b'),(2,'learner-2');
INSERT INTO course_staff_assignments(organization_id,course_id,staff_id,assigned_by) VALUES (1,1,'teacher-1','owner-1'),(2,2,'teacher-2','owner-2');
INSERT INTO academic_assessments(id,organization_id,course_id,period_id,title,category,max_marks,weight,created_by) VALUES
 (1,1,1,1,'Fractions test','test',100,50,'teacher-1'),(2,1,1,1,'Decimals test','test',100,50,'teacher-1'),
 (3,2,2,2,'Other school test','test',100,100,'teacher-2');
INSERT INTO academic_grades(assessment_id,learner_id,marks,status,reviewed_by) VALUES
 (1,'learner-1',80,'published','teacher-1'),(2,'learner-1',20,'draft','teacher-1'),
 (1,'learner-1b',60,'published','teacher-1'),(3,'learner-2',95,'published','teacher-2');
INSERT INTO verified_enrollments(id,organization_id,learner_id,stage,academic_year,status,recorded_by) VALUES
 (1,1,'learner-1','Grade 7',2026,'active','owner-1'),(2,1,'learner-1b','Grade 7',2026,'active','owner-1'),
 (3,2,'learner-2','Grade 7',2026,'active','owner-2');
INSERT INTO guardian_relationships(id,learner_id,guardian_id,status) VALUES
 (1,'learner-1','g-ok','verified'),(2,'learner-1','g-pending','pending'),
 (3,'learner-1','g-other','verified'),(4,'learner-1','g-revoked','verified');
INSERT INTO guardian_verification_events(relationship_id,organization_id,reviewed_by,decision,created_at) VALUES
 (1,1,'owner-1','verified',now()),(3,2,'owner-2','verified',now()),
 (4,1,'owner-1','verified',now()-interval '2 days'),(4,1,'owner-1','revoked',now()-interval '1 day');
`);

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = req.headers["x-test-user"] ? ({ id: String(req.headers["x-test-user"]) } as any) : undefined;
  req.isAuthenticated = (() => !!req.user) as any;
  next();
});
app.use("/api", academicRouter, reportCardsRouter, institutionRecordsRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(r => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
async function call(user: string, path: string, opts: { method?: string; body?: unknown } = {}): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (user) headers["x-test-user"] = user;
  const res = await fetch(base + path, { method: opts.method ?? (opts.body ? "POST" : "GET"), headers, ...(opts.body ? { body: JSON.stringify(opts.body) } : {}) });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const grade = (marks: number) => ({ marks, status: "published", reason: "Synthetic regrade for test" });
const gradeOf = async (assessment: number, learner: string) =>
  (await engine.query<{ marks: number }>("SELECT marks FROM academic_grades WHERE assessment_id=$1 AND learner_id=$2", [assessment, learner])).rows[0]?.marks;

let failures = 0, passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`ok - ${name}`); }
  catch (e) { failures++; console.log(`not ok - ${name}`); console.log(e); }
}

try {
  // --- Marks: only assigned teachers, only their school, only enrolled learners ---
  await check("a teacher cannot grade another school's assessment by any route", async () => {
    assert.equal((await call("teacher-1", "/organizations/2/academic/assessments/3/grades/learner-2", { method: "PUT", body: grade(1) })).status, 403);
    assert.equal((await call("teacher-1", "/organizations/1/academic/assessments/3/grades/learner-2", { method: "PUT", body: grade(1) })).status, 400);
    assert.equal(await gradeOf(3, "learner-2"), 95);
  });
  await check("a teacher not assigned to the subject cannot change its marks", async () => {
    assert.equal((await call("teacher-1b", "/organizations/1/academic/assessments/1/grades/learner-1", { method: "PUT", body: grade(5) })).status, 403);
    assert.equal(await gradeOf(1, "learner-1"), 80);
  });
  await check("marks cannot be recorded for a learner not enrolled in the subject", async () => {
    assert.equal((await call("teacher-1", "/organizations/1/academic/assessments/1/grades/learner-2", { method: "PUT", body: grade(50) })).status, 403);
    assert.equal(await gradeOf(1, "learner-2"), undefined);
  });
  await check("learners cannot change marks, including their own", async () => {
    assert.equal((await call("learner-1", "/organizations/1/academic/assessments/1/grades/learner-1", { method: "PUT", body: grade(100) })).status, 403);
    assert.equal(await gradeOf(1, "learner-1"), 80);
  });
  await check("the assigned teacher's change is applied and audited", async () => {
    const r = await call("teacher-1", "/organizations/1/academic/assessments/1/grades/learner-1b", { method: "PUT", body: grade(65) });
    assert.equal(r.status, 200);
    assert.equal(await gradeOf(1, "learner-1b"), 65);
    const events = (await engine.query<{ old_marks: number; new_marks: number; changed_by: string }>("SELECT old_marks, new_marks, changed_by FROM academic_grade_events")).rows;
    assert.deepEqual(events, [{ old_marks: 60, new_marks: 65, changed_by: "teacher-1" }]);
  });

  // --- Enrolment and staffing stay inside the school ---------------------------
  await check("a school cannot enrol another school's learner or assign another school's teacher", async () => {
    assert.equal((await call("admin-1", "/organizations/1/academic/courses/1/enroll", { body: { userId: "learner-2" } })).status, 400);
    assert.equal((await call("admin-1", "/organizations/1/academic/course-staff", { body: { courseId: 1, email: "teacher2@school2.test" } })).status, 403);
    assert.equal((await call("admin-1", "/organizations/1/academic/course-staff", { body: { courseId: 1, email: "nobody@nowhere.test" } })).status, 403, "same answer for unknown accounts");
    assert.equal((await call("teacher-1", "/organizations/1/academic/courses/1/enroll", { body: { userId: "learner-1" } })).status, 403, "teachers cannot enrol");
  });

  // --- Reading results ---------------------------------------------------------
  await check("a learner's own report shows only their published marks", async () => {
    const r = await call("learner-1", "/organizations/1/academic/my-report");
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.assessments.map((a: any) => [a.title, a.marks]), [["Fractions test", 80]], "draft Decimals mark hidden");
    assert.ok(r.data.results.every((x: any) => x.learnerId === "learner-1"));
  });
  await check("learners cannot use staff reporting or leaderboards", async () => {
    assert.equal((await call("learner-1", "/organizations/1/academic/reports")).status, 403);
    assert.equal((await call("learner-1", "/organizations/1/academic/leaderboard?courseId=1&periodId=1")).status, 403);
  });
  await check("staff reporting is limited to the teacher's own subjects and school", async () => {
    assert.equal((await call("teacher-1b", "/organizations/1/academic/reports")).data.resultCount, 0);
    assert.equal((await call("teacher-1", "/organizations/1/academic/reports")).data.resultCount, 2);
    assert.equal((await call("teacher-1", "/organizations/2/academic/reports")).status, 403);
    assert.equal((await call("teacher-1b", "/organizations/1/academic/leaderboard?courseId=1&periodId=1")).status, 403);
  });
  await check("strangers and other schools see no academic data", async () => {
    for (const path of ["/organizations/1/academic/my-report", "/organizations/1/academic/reports", "/organizations/1/academic/assessments"]) {
      assert.equal((await call("stranger", path)).status, 403, path);
      assert.equal((await call("owner-2", path)).status, 403, path);
    }
  });

  // --- Report cards --------------------------------------------------------
  await check("a learner's report card excludes draft marks", async () => {
    const r = await call("learner-1", "/reports/me?organizationId=1&year=2026");
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.subjects, [{ name: "Mathematics", percentage: 80, assessmentCount: 1 }]);
  });
  await check("learners cannot read another learner's report card", async () => {
    assert.equal((await call("learner-1", "/organizations/1/reports/learner-1b?year=2026")).status, 403);
    assert.equal((await call("teacher-1", "/organizations/1/reports/learner-1?year=2026")).status, 403, "report cards are for school managers");
  });
  await check("a school manager cannot read the report card of a learner enrolled elsewhere", async () => {
    const r = await call("owner-1", "/organizations/1/reports/learner-2?year=2026");
    assert.equal(r.status, 404);
    assert.equal(r.data, null, "no name or marks in the response");
    assert.equal((await call("owner-1", "/organizations/2/reports/learner-2?year=2026")).status, 403);
  });

  // --- Guardian access to a child's report -------------------------------------
  await check("a verified guardian with school verification and active enrolment can read the report", async () => {
    const r = await call("g-ok", "/guardian/reports/learner-1?organizationId=1&year=2026");
    assert.equal(r.status, 200);
    assert.equal(r.data.visibility, "verified_guardian");
    assert.deepEqual(r.data.subjects.map((s: any) => s.percentage), [80]);
  });
  await check("guardians are refused when any link in the chain is missing", async () => {
    assert.equal((await call("g-pending", "/guardian/reports/learner-1?organizationId=1&year=2026")).status, 403, "relationship not verified");
    assert.equal((await call("g-other", "/guardian/reports/learner-1?organizationId=1&year=2026")).status, 403, "verified only at another school");
    assert.equal((await call("g-revoked", "/guardian/reports/learner-1?organizationId=1&year=2026")).status, 403, "latest decision is revoked");
    assert.equal((await call("stranger", "/guardian/reports/learner-1?organizationId=1&year=2026")).status, 403, "no relationship");
    assert.equal((await call("g-ok", "/guardian/reports/learner-2?organizationId=2&year=2026")).status, 403, "not this child's guardian");
  });
  await check("a guardian's access ends when the enrolment is no longer active", async () => {
    await engine.exec("UPDATE verified_enrollments SET status='withdrawn' WHERE id=1");
    assert.equal((await call("g-ok", "/guardian/reports/learner-1?organizationId=1&year=2026")).status, 403);
    await engine.exec("UPDATE verified_enrollments SET status='active' WHERE id=1");
  });

  // --- Institution records and learner-initiated gates (F-2026-11-22-02) -------
  await check("verified enrolments are visible only to the school's own managers", async () => {
    assert.equal((await call("owner-2", "/organizations/1/verified-enrollments")).status, 403);
    assert.equal((await call("teacher-1", "/organizations/1/verified-enrollments")).status, 403);
    const own = await call("owner-1", "/organizations/1/verified-enrollments");
    assert.deepEqual(own.data.map((e: any) => e.learnerId).sort(), ["learner-1", "learner-1b"]);
  });
  await check("learner-initiated guardian invites and transfers are off by default", async () => {
    delete process.env.ENABLE_LEARNER_GUARDIAN_INVITES;
    delete process.env.ENABLE_LEARNER_TRANSFER_REQUESTS;
    assert.equal((await call("learner-1", "/guardian-relationships", { body: { guardianEmail: "g.ok@family.test" } })).status, 404);
    assert.equal((await call("learner-1", "/institution-records/transfers", { body: { enrollmentId: 1, toOrganizationId: 2 } })).status, 404);
    assert.equal((await call("learner-1", "/institution-records/transfers", { body: { enrollmentId: 1, toOrganizationId: 999 } })).status, 404, "no school-id oracle");
  });
  await check("when enabled, guardian requests answer identically for known, unknown and own emails", async () => {
    process.env.ENABLE_LEARNER_GUARDIAN_INVITES = "true";
    try {
      const known = await call("learner-1b", "/guardian-relationships", { body: { guardianEmail: "g.ok@family.test" } });
      const unknown = await call("learner-1b", "/guardian-relationships", { body: { guardianEmail: "nobody@nowhere.test" } });
      const self = await call("learner-1b", "/guardian-relationships", { body: { guardianEmail: "learner1b@school1.test" } });
      const again = await call("learner-1b", "/guardian-relationships", { body: { guardianEmail: "g.ok@family.test" } });
      assert.equal(known.status, 202);
      for (const r of [unknown, self, again]) assert.deepEqual(r, known);
      const rows = (await engine.query<{ guardian_id: string; status: string }>("SELECT guardian_id, status FROM guardian_relationships WHERE learner_id='learner-1b'")).rows;
      assert.deepEqual(rows, [{ guardian_id: "g-ok", status: "pending" }], "only the real, different account gets one pending request");
    } finally {
      delete process.env.ENABLE_LEARNER_GUARDIAN_INVITES;
    }
  });
  await check("only the addressed guardian can answer a request", async () => {
    const [req] = (await engine.query<{ id: number }>("SELECT id FROM guardian_relationships WHERE learner_id='learner-1b'")).rows;
    assert.equal((await call("stranger", `/guardian-relationships/${req.id}/decision`, { body: { decision: "accepted" } })).status, 404);
    assert.equal((await call("learner-1b", `/guardian-relationships/${req.id}/decision`, { body: { decision: "accepted" } })).status, 404, "learner cannot accept on the guardian's behalf");
    assert.equal((await call("g-ok", `/guardian-relationships/${req.id}/decision`, { body: { decision: "accepted" } })).status, 200);
    assert.equal((await call("g-ok", "/guardian/reports/learner-1b?organizationId=1&year=2026")).status, 403, "accepted is not verified: no report until the school verifies");
  });
} finally {
  server.close();
  await engine.close();
}
console.log(`# academic records integration: ${passed} passed, ${failures} failed`);
if (failures > 0) process.exitCode = 1;
