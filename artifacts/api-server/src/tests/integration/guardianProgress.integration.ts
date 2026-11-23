// Synthetic two-school HTTP/database tests for guardian child-progress
// analytics. Database generated from the real Drizzle schema. Bundle with
// @workspace/db aliased to supportTestDb.ts (see scripts/test-guardian-progress.mjs).
import assert from "node:assert/strict";
import express from "express";
import guardianProgressRouter from "../../routes/guardianProgress";
import { engine } from "./supportTestDb";
import { createSchemaFromDrizzle, syncSequences } from "./schemaFromDrizzle";

const statementCount = await createSchemaFromDrizzle();
console.log(`# schema: ${statementCount} statements generated from lib/db/src/schema`);

// School 1: learner-1 (the child) and five classmates c2..c6 in Grade 7.
// Maths has 6 results in Term 2 (comparison allowed); English only 3 (withheld).
// Guardians: g-ok (verified at school 1), g-other (verified only at school 2),
// g-revoked (later revoked by school 1). learner-2 is at school 2.
await engine.exec(`
INSERT INTO users(id,email,first_name,last_name) VALUES
 ('owner-1','owner1@school1.test','One','Owner'),('teacher-1','teacher1@school1.test','Tess','Teacher'),
 ('learner-1','learner1@school1.test','Lerato','Mokoena'),
 ('c2','c2@school1.test','Classmate','Two'),('c3','c3@school1.test','Classmate','Three'),('c4','c4@school1.test','Classmate','Four'),
 ('c5','c5@school1.test','Classmate','Five'),('c6','c6@school1.test','Classmate','Six'),
 ('owner-2','owner2@school2.test','Two','Owner'),('learner-2','learner2@school2.test','Kagiso','Other'),
 ('g-ok','g.ok@family.test','Grace','Guardian'),('g-other','g.other@family.test','Otto','Other'),
 ('g-revoked','g.revoked@family.test','Rae','Revoked'),('stranger','stranger@nowhere.test','Sam','Stranger');
INSERT INTO organizations(id,name,owner_id) VALUES (1,'Synthetic School 1','owner-1'),(2,'Synthetic School 2','owner-2');
INSERT INTO organization_members(organization_id,user_id,role) VALUES
 (1,'owner-1','owner'),(1,'teacher-1','teacher'),(1,'learner-1','learner'),(1,'c2','learner'),(1,'c3','learner'),(1,'c4','learner'),(1,'c5','learner'),(1,'c6','learner'),
 (2,'owner-2','owner'),(2,'learner-2','learner');
INSERT INTO verified_enrollments(id,organization_id,learner_id,stage,academic_year,status,recorded_by) VALUES
 (1,1,'learner-1','Grade 7',2026,'active','owner-1'),(2,2,'learner-2','Grade 7',2026,'active','owner-2');
INSERT INTO academic_courses(id,organization_id,name,code,level) VALUES
 (1,1,'Mathematics','MATH7','Grade 7'),(2,1,'English','ENG7','Grade 7'),(3,2,'Mathematics','MATH7','Grade 7');
INSERT INTO academic_periods(id,organization_id,name,year,begins_at) VALUES
 (1,1,'Term 1',2026,'2026-01-14'),(2,1,'Term 2',2026,'2026-04-08'),(3,2,'Term 1',2026,'2026-01-14');
INSERT INTO academic_assessments(id,organization_id,course_id,period_id,title,category,max_marks,weight,created_by) VALUES
 (1,1,1,1,'Fractions test','test',100,1,'teacher-1'),(2,1,1,2,'Algebra test','test',100,1,'teacher-1'),
 (3,1,2,1,'Essay','assignment',100,1,'teacher-1'),(4,1,2,2,'Comprehension','test',100,1,'teacher-1'),
 (5,1,1,2,'Algebra quiz','test',100,1,'teacher-1'),(6,2,3,3,'Other school test','test',100,1,'owner-2');
INSERT INTO academic_grades(assessment_id,learner_id,marks,status,reviewed_by,updated_at) VALUES
 (1,'learner-1',60,'published','teacher-1','2026-03-01'),(2,'learner-1',72,'published','teacher-1','2026-05-20'),
 (3,'learner-1',80,'published','teacher-1','2026-03-02'),(4,'learner-1',74,'published','teacher-1','2026-05-21'),
 (5,'learner-1',0,'draft','teacher-1','2026-05-22'),
 (2,'c2',50,'published','teacher-1',now()),(2,'c3',60,'published','teacher-1',now()),(2,'c4',65,'published','teacher-1',now()),
 (2,'c5',80,'published','teacher-1',now()),(2,'c6',90,'published','teacher-1',now()),
 (4,'c2',99,'published','teacher-1',now()),(4,'c3',12,'published','teacher-1',now()),
 (6,'learner-2',95,'published','owner-2',now());
INSERT INTO school_attendance(organization_id,learner_id,day,status,note,recorded_by) VALUES
 (1,'learner-1','2026-03-02','present','','owner-1'),(1,'learner-1','2026-03-03','present','','owner-1'),(1,'learner-1','2026-03-04','present','','owner-1'),
 (1,'learner-1','2026-03-05','present','','owner-1'),(1,'learner-1','2026-03-06','absent','Synthetic staff-only note','owner-1'),
 (1,'learner-1','2026-03-09','present','','owner-1'),(1,'learner-1','2026-03-10','late','','owner-1'),(1,'learner-1','2026-03-11','present','','owner-1'),
 (1,'learner-1','2026-03-12','present','','owner-1'),(1,'learner-1','2026-03-13','present','','owner-1');
INSERT INTO guardian_relationships(id,learner_id,guardian_id,status) VALUES
 (1,'learner-1','g-ok','verified'),(2,'learner-1','g-other','verified'),(3,'learner-1','g-revoked','verified');
INSERT INTO guardian_verification_events(relationship_id,organization_id,reviewed_by,decision,created_at) VALUES
 (1,1,'owner-1','verified',now()),(2,2,'owner-2','verified',now()),
 (3,1,'owner-1','verified',now()-interval '2 days'),(3,1,'owner-1','revoked',now()-interval '1 day');
`);
await syncSequences(["organizations", "verified_enrollments", "academic_courses", "academic_periods", "academic_assessments", "guardian_relationships"]);

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = req.headers["x-test-user"] ? ({ id: String(req.headers["x-test-user"]) } as any) : undefined;
  req.isAuthenticated = (() => !!req.user) as any;
  next();
});
app.use("/api", guardianProgressRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(r => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
async function call(user: string, path: string): Promise<{ status: number; data: any }> {
  const res = await fetch(base + path, { headers: user ? { "x-test-user": user } : {} });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const progressPath = (learner = "learner-1", org = 1) => `/guardian/progress/${learner}?organizationId=${org}&year=2026`;

let failures = 0, passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`ok - ${name}`); }
  catch (e) { failures++; console.log(`not ok - ${name}`); console.log(e); }
}

try {
  await check("guardians see only children they are verified for at each school", async () => {
    assert.equal((await call("", "/guardian/children")).status, 401);
    const ok = await call("g-ok", "/guardian/children");
    assert.deepEqual(ok.data, [{ learnerId: "learner-1", learnerName: "Lerato Mokoena", organizationId: 1, organization: "Synthetic School 1", grade: "Grade 7", academicYear: 2026 }]);
    assert.deepEqual((await call("g-other", "/guardian/children")).data, [], "verified only at a school the child does not attend");
    assert.deepEqual((await call("g-revoked", "/guardian/children")).data, [], "school's latest decision is revoked");
    assert.deepEqual((await call("stranger", "/guardian/children")).data, []);
  });

  let progress: any;
  await check("a verified guardian gets term-by-term results with improvement", async () => {
    const r = await call("g-ok", progressPath());
    assert.equal(r.status, 200);
    progress = r.data;
    assert.equal(progress.learnerName, "Lerato Mokoena");
    const maths = progress.subjects.find((s: any) => s.subject === "Mathematics");
    assert.deepEqual(maths.terms, [{ period: "Term 1", percentage: 60 }, { period: "Term 2", percentage: 72 }], "draft 0% quiz excluded");
    assert.equal(maths.change, 12);
    assert.equal(maths.trend, "improving");
    assert.equal(maths.assessments, 2);
    assert.deepEqual(progress.overall.terms, [{ period: "Term 1", percentage: 70 }, { period: "Term 2", percentage: 73 }]);
    assert.equal(progress.overall.trend, "improving");
    assert.deepEqual(progress.highlights.mostImproved, [{ subject: "Mathematics", change: 12 }]);
  });
  await check("class standing is aggregate-only and withheld for small groups", async () => {
    const maths = progress.subjects.find((s: any) => s.subject === "Mathematics");
    assert.deepEqual(maths.standing, { available: true, cohortSize: 6, classAverage: 70, band: "upper_middle", differenceFromAverage: 3 });
    const english = progress.subjects.find((s: any) => s.subject === "English");
    assert.equal(english.standing.available, false, "only 3 English results in Term 2");
    const json = JSON.stringify(progress);
    for (const leak of ["c2", "c3", "c4", "c5", "c6", "Classmate", "learner-2", "Kagiso"]) {
      assert.ok(!json.includes(`"${leak}"`) && !json.includes(leak + " "), `no classmate identity: ${leak}`);
    }
  });
  await check("outlook, focus areas, attendance and recent results reflect published data", async () => {
    assert.equal(progress.outlook.status, "watch", "English dropped 6 points");
    assert.deepEqual(progress.highlights.focusAreas.map((f: any) => f.subject), ["English"]);
    assert.equal(progress.attendance.rate, 90);
    assert.equal(progress.attendance.recordedDays, 10);
    assert.doesNotMatch(JSON.stringify(progress.attendance), /note|staff-only/);
    assert.deepEqual(progress.recentResults.map((r: any) => r.assessment), ["Comprehension", "Algebra test", "Essay", "Fractions test"], "newest first, draft quiz absent");
    assert.equal(progress.method.minCohortForComparison, 5);
  });

  await check("every other guardian, school or child combination is refused the same way", async () => {
    for (const [user, path, why] of [
      ["g-other", progressPath(), "verified only at another school"],
      ["g-revoked", progressPath(), "latest decision revoked"],
      ["stranger", progressPath(), "no relationship"],
      ["teacher-1", progressPath(), "staff use staff reporting, not the guardian view"],
      ["g-ok", progressPath("learner-1", 2), "child not enrolled at that school"],
      ["g-ok", progressPath("learner-2", 2), "not this guardian's child"],
      ["g-ok", progressPath("c2", 1), "a classmate"],
    ] as const) {
      const r = await call(user, path);
      assert.equal(r.status, 403, why);
      assert.equal(r.data, null, `no body: ${why}`);
    }
    assert.equal((await call("g-ok", "/guardian/progress/learner-1?year=2026")).status, 400, "school is required");
    assert.equal((await call("", progressPath())).status, 401);
  });
  await check("access ends when the child's enrolment is no longer active", async () => {
    await engine.exec("UPDATE verified_enrollments SET status='withdrawn' WHERE id=1");
    try {
      assert.equal((await call("g-ok", progressPath())).status, 403);
      assert.deepEqual((await call("g-ok", "/guardian/children")).data, []);
    } finally {
      await engine.exec("UPDATE verified_enrollments SET status='active' WHERE id=1");
    }
  });
  await check("a year without published results returns an honest empty view", async () => {
    const r = await call("g-ok", "/guardian/progress/learner-1?organizationId=1&year=2025");
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.subjects, []);
    assert.equal(r.data.outlook.status, "not_enough_data");
  });
} finally {
  server.close();
  await engine.close();
}
console.log(`# guardian progress integration: ${passed} passed, ${failures} failed`);
if (failures > 0) process.exitCode = 1;
