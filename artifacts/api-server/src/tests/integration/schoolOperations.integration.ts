// Synthetic two-school HTTP/database tests for guardian verification,
// attendance, notices, career-opportunity applications and timetables.
// Database generated from the real Drizzle schema. Bundle with @workspace/db
// aliased to supportTestDb.ts (see scripts/test-school-operations.mjs).
import assert from "node:assert/strict";
import express from "express";
import guardianVerificationRouter from "../../routes/guardianVerification";
import educationTalentRouter from "../../routes/educationTalent";
import timetableRouter from "../../routes/timetable";
import { engine } from "./supportTestDb";
import { createSchemaFromDrizzle, syncSequences } from "./schemaFromDrizzle";

const statementCount = await createSchemaFromDrizzle();
console.log(`# schema: ${statementCount} statements generated from lib/db/src/schema`);

await engine.exec(`
INSERT INTO users(id,email,first_name,last_name) VALUES
 ('owner-1','owner1@school1.test','One','Owner'),('admin-1','admin1@school1.test','One','Admin'),
 ('teacher-1','teacher1@school1.test','Tess','Teacher'),('teacher-1b','teacher1b@school1.test','Ted','Other'),
 ('learner-1','learner1@school1.test','Lerato','Learner'),
 ('owner-2','owner2@school2.test','Two','Owner'),('teacher-2','teacher2@school2.test','Thabo','Teacher'),
 ('learner-2','learner2@school2.test','Kagiso','Learner'),
 ('g-accepted','g.accepted@family.test','Ama','Accepted'),('g-pending','g.pending@family.test','Pat','Pending'),
 ('g-2','g.two@family.test','Gwen','Two'),('stranger','stranger@nowhere.test','Sam','Stranger');
INSERT INTO organizations(id,name,owner_id) VALUES (1,'Synthetic School 1','owner-1'),(2,'Synthetic School 2','owner-2');
INSERT INTO organization_members(organization_id,user_id,role) VALUES
 (1,'owner-1','owner'),(1,'admin-1','admin'),(1,'teacher-1','teacher'),(1,'teacher-1b','teacher'),(1,'learner-1','learner'),
 (2,'owner-2','owner'),(2,'teacher-2','teacher'),(2,'learner-2','learner');
INSERT INTO verified_enrollments(id,organization_id,learner_id,stage,academic_year,status,recorded_by) VALUES
 (1,1,'learner-1','Grade 7',2026,'active','owner-1'),(2,2,'learner-2','Grade 7',2026,'active','owner-2');
INSERT INTO guardian_relationships(id,learner_id,guardian_id,status) VALUES
 (1,'learner-1','g-accepted','accepted'),(2,'learner-1','g-pending','pending'),(3,'learner-2','g-2','accepted');
INSERT INTO school_attendance(organization_id,learner_id,day,status,note,recorded_by) VALUES
 (1,'learner-1','2026-03-02','absent','Synthetic staff-only note','admin-1'),
 (2,'learner-2','2026-03-02','present','School 2 staff note','owner-2');
INSERT INTO school_notices(organization_id,subject,message,audience,created_by) VALUES
 (1,'Sports day','Sports day is on Friday for everyone.','all','admin-1'),
 (1,'Homework club','Homework club meets on Tuesdays.','learners','admin-1'),
 (1,'Staff meeting','Confidential staff planning meeting.','staff','admin-1'),
 (2,'Other school notice','Only for school two members.','all','owner-2');
INSERT INTO school_timetable_slots(id,organization_id,academic_year,day,starts_at,ends_at,grade,group_name,subject,room,teacher_id,status,created_by) VALUES
 (1,1,2026,1,'08:00','09:00','7','A','Mathematics','R1','teacher-1','published','admin-1'),
 (2,1,2026,1,'09:00','10:00','7','A','Science','R1','teacher-1','draft','admin-1'),
 (3,1,2026,2,'08:00','09:00','7','A','English','R2','teacher-1b','published','admin-1'),
 (4,2,2026,1,'08:00','09:00','7','B','Mathematics','S1','teacher-2','published','owner-2');
INSERT INTO career_opportunities(id,organization_id,created_by,title,kind,description) VALUES
 (1,1,'owner-1','Holiday tutor','internship','Synthetic opportunity one.'),(2,2,'owner-2','Coding club lead','volunteer','Synthetic opportunity two.');
INSERT INTO career_applications(opportunity_id,candidate_id,statement) VALUES (2,'learner-2','I would like to lead the coding club this year.');
`);
await syncSequences(["organizations", "verified_enrollments", "guardian_relationships", "school_timetable_slots", "career_opportunities"]);

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = req.headers["x-test-user"] ? ({ id: String(req.headers["x-test-user"]) } as any) : undefined;
  req.isAuthenticated = (() => !!req.user) as any;
  next();
});
app.use("/api", guardianVerificationRouter, educationTalentRouter, timetableRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(r => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
async function call(user: string, path: string, opts: { method?: string; body?: unknown } = {}): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (user) headers["x-test-user"] = user;
  const res = await fetch(base + path, { method: opts.method ?? (opts.body ? "POST" : "GET"), headers, ...(opts.body ? { body: JSON.stringify(opts.body) } : {}) });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const relationship = async (id: number) =>
  (await engine.query<{ status: string }>("SELECT status FROM guardian_relationships WHERE id=$1", [id])).rows[0]?.status;

let failures = 0, passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`ok - ${name}`); }
  catch (e) { failures++; console.log(`not ok - ${name}`); console.log(e); }
}

try {
  // --- Guardian verification (gates guardian access to a child's reports) ------
  await check("each school's review queue lists only guardians of its own enrolled learners", async () => {
    assert.deepEqual((await call("admin-1", "/organizations/1/guardian-reviews")).data.map((r: any) => r.id).sort(), [1, 2]);
    assert.deepEqual((await call("owner-2", "/organizations/2/guardian-reviews")).data.map((r: any) => r.id), [3]);
    assert.equal((await call("teacher-1", "/organizations/1/guardian-reviews")).status, 403);
    assert.equal((await call("stranger", "/organizations/1/guardian-reviews")).status, 403);
    assert.equal((await call("", "/organizations/1/guardian-reviews")).status, 401);
  });
  await check("a school cannot verify a guardian for a learner it does not enrol", async () => {
    const r = await call("owner-2", "/organizations/2/guardian-reviews/1", { body: { decision: "verified", evidenceReviewed: true } });
    assert.equal(r.status, 409);
    assert.equal(r.data.error, "not_enrolled");
    assert.equal(await relationship(1), "accepted");
  });
  await check("verification needs a school manager, reviewed evidence and the guardian's acceptance", async () => {
    assert.equal((await call("teacher-1", "/organizations/1/guardian-reviews/1", { body: { decision: "verified", evidenceReviewed: true } })).status, 403);
    assert.equal((await call("admin-1", "/organizations/1/guardian-reviews/1", { body: { decision: "verified" } })).status, 400);
    assert.equal((await call("admin-1", "/organizations/1/guardian-reviews/1", { body: { decision: "verified", evidenceReviewed: false } })).status, 400);
    const pending = await call("admin-1", "/organizations/1/guardian-reviews/2", { body: { decision: "verified", evidenceReviewed: true } });
    assert.equal(pending.status, 409);
    assert.equal(pending.data.error, "guardian_must_accept_first");
    assert.equal((await call("admin-1", "/organizations/1/guardian-reviews/999", { body: { decision: "verified", evidenceReviewed: true } })).status, 404);
  });
  await check("an authorised verification is recorded against the verifying school", async () => {
    const r = await call("admin-1", "/organizations/1/guardian-reviews/1", { body: { decision: "verified", evidenceReviewed: true } });
    assert.equal(r.status, 200);
    assert.equal(await relationship(1), "verified");
    const events = (await engine.query("SELECT relationship_id, organization_id, reviewed_by, decision FROM guardian_verification_events")).rows;
    assert.deepEqual(events, [{ relationship_id: 1, organization_id: 1, reviewed_by: "admin-1", decision: "verified" }]);
  });

  // --- Attendance ------------------------------------------------------------
  await check("attendance can only be recorded by a school's managers, for its own learners", async () => {
    assert.equal((await call("admin-1", "/organizations/1/attendance", { body: { learnerId: "learner-2", day: "2026-03-03", status: "absent" } })).status, 409);
    assert.equal((await call("teacher-1", "/organizations/1/attendance", { body: { learnerId: "learner-1", day: "2026-03-03", status: "present" } })).status, 403);
    assert.equal((await call("owner-2", "/organizations/1/attendance", { body: { learnerId: "learner-1", day: "2026-03-03", status: "absent" } })).status, 403);
    assert.equal((await call("admin-1", "/organizations/1/attendance", { body: { learnerId: "learner-1", day: "2026-03-03", status: "present" } })).status, 200);
  });
  await check("a learner's scoped attendance shows only their own days and statuses", async () => {
    const r = await call("learner-1", "/organizations/1/attendance/me");
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.attendance.map((a: any) => Object.keys(a).sort()), [["day", "status"], ["day", "status"]]);
    assert.deepEqual((await call("learner-1", "/organizations/2/attendance/me")).data.attendance, [], "no other school's records");
  });
  await check("the all-schools attendance view never exposes staff notes or the recorder", async () => {
    const r = await call("learner-1", "/school/attendance/me");
    assert.equal(r.status, 200);
    assert.equal(r.data.length, 2);
    for (const row of r.data) {
      assert.deepEqual(Object.keys(row).sort(), ["day", "id", "organizationId", "status"]);
    }
    assert.doesNotMatch(JSON.stringify(r.data), /staff-only note|admin-1|School 2/);
  });

  // --- Notices ----------------------------------------------------------------
  await check("learners do not see staff-only notices; staff do", async () => {
    const learner = await call("learner-1", "/organizations/1/notices");
    assert.deepEqual(learner.data.map((n: any) => n.subject).sort(), ["Homework club", "Sports day"]);
    assert.equal((await call("teacher-1", "/organizations/1/notices")).data.length, 3);
  });
  await check("only a school's own managers can post notices, and outsiders read none", async () => {
    const notice = { subject: "Test notice", message: "A synthetic test notice body.", audience: "all" };
    assert.equal((await call("teacher-1", "/organizations/1/notices", { body: notice })).status, 403);
    assert.equal((await call("owner-2", "/organizations/1/notices", { body: notice })).status, 403);
    assert.equal((await call("stranger", "/organizations/1/notices")).status, 403);
    assert.equal((await call("learner-2", "/organizations/1/notices")).status, 403);
  });

  // --- Career opportunity applications ------------------------------------------
  await check("a school cannot read applications to another school's opportunity", async () => {
    assert.equal((await call("admin-1", "/organizations/1/opportunities/2/applications")).status, 404);
    assert.equal((await call("admin-1", "/organizations/2/opportunities/2/applications")).status, 403);
    const own = await call("owner-2", "/organizations/2/opportunities/2/applications");
    assert.equal(own.status, 200);
    assert.deepEqual(Object.keys(own.data[0]).sort(), ["candidateId", "createdAt", "id", "status", "statement"]);
  });
  await check("applications stay closed while the safeguards flag is off", async () => {
    delete process.env.ENABLE_CAREER_APPLICATIONS_PILOT;
    assert.equal((await call("learner-1", "/opportunities/1/applications", { body: { statement: "I would like to tutor during the holidays." } })).status, 503);
  });

  // --- Timetables ---------------------------------------------------------------
  await check("timetable visibility follows role: managers all, teachers own published, learners published", async () => {
    const ids = async (user: string, org = 1) => (await call(user, `/organizations/${org}/timetable?year=2026`)).data.map((s: any) => s.id).sort();
    assert.deepEqual(await ids("admin-1"), [1, 2, 3]);
    assert.deepEqual(await ids("teacher-1"), [1]);
    assert.deepEqual(await ids("learner-1"), [1, 3]);
    assert.deepEqual(await ids("owner-2", 2), [4]);
    assert.equal((await call("stranger", "/organizations/1/timetable?year=2026")).status, 403);
    assert.equal((await call("owner-2", "/organizations/1/timetable?year=2026")).status, 403);
  });
  await check("timetables cannot use another school's teachers or change another school's slots", async () => {
    const slot = { academicYear: 2026, day: 3, startsAt: "08:00", endsAt: "09:00", grade: "7", group: "A", subject: "History", room: "R3", teacherId: "teacher-2" };
    assert.equal((await call("admin-1", "/organizations/1/timetable", { body: slot })).status, 409);
    assert.equal((await call("teacher-1", "/organizations/1/timetable", { body: { ...slot, teacherId: "teacher-1" } })).status, 403);
    const swap = (replacementTeacherId: string) => ({ replacementTeacherId, reason: "Synthetic absence cover" });
    assert.equal((await call("admin-1", "/organizations/1/timetable/1/substitution", { method: "PATCH", body: swap("teacher-2") })).status, 409);
    assert.equal((await call("admin-1", "/organizations/1/timetable/4/substitution", { method: "PATCH", body: swap("teacher-1b") })).status, 404);
    assert.equal((await call("admin-1", "/organizations/2/timetable/4/substitution", { method: "PATCH", body: swap("teacher-1b") })).status, 403);
    const slot4 = (await engine.query<{ teacher_id: string }>("SELECT teacher_id FROM school_timetable_slots WHERE id=4")).rows[0];
    assert.equal(slot4.teacher_id, "teacher-2");
  });
} finally {
  server.close();
  await engine.close();
}
console.log(`# school operations integration: ${passed} passed, ${failures} failed`);
if (failures > 0) process.exitCode = 1;
