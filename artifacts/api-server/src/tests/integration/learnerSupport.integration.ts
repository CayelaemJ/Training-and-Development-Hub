import institutionRecordsRouter from "../../routes/institutionRecords";
import progressionRouter from "../../routes/schoolProgression";
// Synthetic HTTP/database tests. Bundle with @workspace/db aliased to supportTestDb.ts.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import router from "../../routes/learnerSupport";
import frameworkRouter from "../../routes/educationFrameworks";
import { engine } from "./supportTestDb";
process.env.ENABLE_LEARNER_SUCCESS_LOOP = "true";
await engine.exec(`CREATE TABLE users(id varchar PRIMARY KEY,first_name varchar,last_name varchar); CREATE TABLE organizations(id integer PRIMARY KEY);
CREATE TABLE organization_members(organization_id integer,user_id varchar,role varchar,joined_at timestamptz DEFAULT now());
CREATE TABLE academic_courses(id integer PRIMARY KEY,organization_id integer,name varchar,code varchar,level varchar,credits integer,created_at timestamptz DEFAULT now());
CREATE TABLE academic_enrollments(id serial PRIMARY KEY,course_id integer,user_id varchar,created_at timestamptz DEFAULT now());
CREATE TABLE course_staff_assignments(organization_id integer,course_id integer,staff_id varchar,assigned_by varchar,assigned_at timestamptz DEFAULT now());
CREATE TABLE verified_enrollments(id serial PRIMARY KEY,organization_id integer,learner_id varchar,stage varchar(28),academic_year integer,status varchar DEFAULT 'active',recorded_by varchar,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(organization_id,learner_id,stage,academic_year));
CREATE TABLE school_progression_events(id serial PRIMARY KEY,organization_id integer,prior_enrollment_id integer,new_enrollment_id integer,learner_id varchar,from_grade varchar(28),to_grade varchar(28),decision varchar,approved_by varchar,approved_at timestamptz DEFAULT now());
CREATE TABLE academic_assessments(id integer PRIMARY KEY,organization_id integer,course_id integer,category varchar,max_marks real,title varchar);
CREATE TABLE academic_grades(id integer PRIMARY KEY,assessment_id integer,learner_id varchar,marks real,status varchar,updated_at timestamptz DEFAULT now());
INSERT INTO users(id) VALUES ('child-a'),('child-b'),('teacher-a'),('teacher-b'),('head-a'); INSERT INTO organizations VALUES(1),(2);
INSERT INTO organization_members(organization_id,user_id,role) VALUES (1,'child-a','learner'),(2,'child-b','learner'),(1,'teacher-a','teacher'),(2,'teacher-b','teacher'),(1,'head-a','admin');
INSERT INTO academic_courses(id,organization_id,name,code,level) VALUES(1,1,'Mathematics','MATH','7'),(2,2,'Mathematics','MATH','7');
INSERT INTO academic_enrollments(course_id,user_id) VALUES(1,'child-a'),(2,'child-b');
INSERT INTO course_staff_assignments(organization_id,course_id,staff_id,assigned_by) VALUES(1,1,'teacher-a','head-a'),(2,2,'teacher-b','head-a');
INSERT INTO academic_assessments VALUES(1,1,1,'test',100,'Initial fractions test'),(2,1,1,'test',100,'Follow-up fractions test'),(3,2,2,'test',100,'Other school');
INSERT INTO academic_grades VALUES(1,1,'child-a',42,'published',now()-interval '1 day'),(2,2,'child-a',72,'published',now()+interval '1 minute'),(3,3,'child-b',90,'published',now());`);
const migration = await readFile(
  process.cwd() + "/lib/db/migrations/20261021_learner_success_loop.sql",
  "utf8",
);
await engine.exec(migration);
await engine.exec(migration); // additive replay safety
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.user = req.headers["x-test-user"]
    ? ({ id: String(req.headers["x-test-user"]) } as any)
    : undefined;
  req.isAuthenticated = (() => !!req.user) as any;
  next();
});
app.use(
  "/api",
  router,
  frameworkRouter,
  institutionRecordsRouter,
  progressionRouter,
);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const address = server.address() as { port: number };
const base = `http://127.0.0.1:${address.port}/api`;
async function call(
  user: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: any }> {
  const res = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { "x-test-user": user, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
try {
  assert.equal((await call("", "/organizations/1/support")).status, 401);
  const cfg = {
    countryCode: "BW",
    frameworkCode: "BGCSE",
    name: "Botswana pilot",
    timeZone: "Africa/Gaborone",
    languages: ["en", "tn-BW"],
    settings: {
      levels: ["Form 1", "Form 2"],
      curriculumVersion: "pilot-2026",
      notes: "School reviewed pilot only",
      gradingScale: [
        { label: "Developing", minimumPercent: 0 },
        { label: "Pass", minimumPercent: 50 },
      ],
    },
  };
  assert.equal(
    (await call("child-a", "/organizations/1/education-framework", cfg)).status,
    403,
  );
  assert.equal(
    (await call("head-a", "/organizations/1/education-framework", cfg)).status,
    201,
  );
  assert.equal(
    (await call("teacher-b", "/organizations/1/education-framework")).status,
    403,
  );
  const enrollment = await call(
    "head-a",
    "/organizations/1/verified-enrollments",
    { learnerId: "child-a", stage: "Form 1", academicYear: 2026 },
  );
  assert.equal(enrollment.status, 201);
  assert.equal(
    (
      await call("head-a", "/organizations/1/verified-enrollments", {
        learnerId: "child-a",
        stage: "Grade 99",
        academicYear: 2026,
      })
    ).status,
    400,
  );
  const promoted = await call(
    "head-a",
    "/organizations/1/progression/" + enrollment.data.id,
    { targetYear: 2027, decision: "promote" },
  );
  assert.equal(promoted.status, 201);
  assert.equal(promoted.data.toGrade, "Form 2");
  assert.equal(
    (
      await call("head-a", "/organizations/1/progression/" + promoted.data.id, {
        targetYear: 2028,
        decision: "promote",
      })
    ).status,
    409,
  );
  const body = {
    courseId: 1,
    concept: "Fractions",
    question: "How do I add unlike fractions?",
    attempted: "I tried adding denominators",
    requestKey: crypto.randomUUID(),
  };
  assert.equal(
    (await call("child-b", "/organizations/1/support", body)).status,
    403,
  );
  const created = await call("child-a", "/organizations/1/support", body);
  assert.equal(created.status, 201);
  assert.ok(created.data.frameworkVersionId);
  const ticketId = created.data.id;
  const path = "/organizations/1/support/" + ticketId;
  assert.equal((await call("teacher-a", path)).data.publishedResults.length, 2);
  assert.equal(
    (await call("child-a", path + "/guidance-draft", {})).data.source,
    "non_ai_template",
  );
  assert.equal(
    (await call("child-a", "/organizations/1/support", body)).data.id,
    ticketId,
  );
  assert.equal(
    (
      await call("child-a", "/organizations/1/support", {
        ...body,
        question: "Different question with same key",
      })
    ).status,
    409,
  );
  assert.equal((await call("teacher-b", path)).status, 404);
  assert.equal((await call("child-b", path)).status, 404);
  assert.deepEqual(
    (await call("teacher-b", "/organizations/1/support")).data,
    null,
  );
  assert.equal(
    (
      await call("child-a", path + "/actions", {
        version: 1,
        action: {
          kind: "transition",
          status: "triaged",
          reason: "I triaged it",
        },
      })
    ).status,
    409,
  );
  let ticket = created.data;
  async function act(action: any, user = "teacher-a") {
    const r = await call(user, path + "/actions", {
      version: ticket.version,
      action,
    });
    assert.equal(r.status, 200, JSON.stringify(r));
    ticket = r.data;
  }
  await act({
    kind: "transition",
    status: "triaged",
    reason: "Teacher reviewed concept",
  });
  const stale = await call("teacher-a", path + "/actions", {
    version: 1,
    action: { kind: "reply", body: "Stale edit" },
  });
  assert.equal(stale.status, 409);
  assert.equal(
    (
      await call("teacher-a", path + "/actions", {
        version: ticket.version,
        action: { kind: "assign", staffId: "teacher-b" },
      })
    ).status,
    403,
  );
  await act({ kind: "assign", staffId: "teacher-a" });
  await act({
    kind: "transition",
    status: "assigned",
    reason: "Assigned subject teacher",
  });
  await act({
    kind: "transition",
    status: "in_progress",
    reason: "Start targeted assistance",
  });
  await act({
    kind: "practice",
    body: "Find equivalent denominators before adding fractions",
    reviewAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await act({
    kind: "transition",
    status: "follow_up_required",
    reason: "Practice assigned for checkpoint",
  });
  assert.equal(
    (
      await call("teacher-a", path + "/actions", {
        version: ticket.version,
        action: {
          kind: "transition",
          status: "resolved",
          reason: "Closing without evidence",
        },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("teacher-a", path + "/actions", {
        version: ticket.version,
        action: {
          kind: "outcome",
          baselineGradeId: 1,
          followupGradeId: 3,
          comparisonReason:
            "This is intentionally cross-school invalid evidence",
        },
      })
    ).status,
    409,
  );
  await act({
    kind: "outcome",
    baselineGradeId: 1,
    followupGradeId: 2,
    comparisonReason:
      "Both moderated tests assess equivalent fractions objectives with comparable difficulty",
  });
  assert.equal(ticket.outcome.improvementPp, 30);
  await act({
    kind: "learning_dna",
    state: "demonstrated",
    body: "Teacher reviewed both fractions assessments and the learner explanation",
  });
  await act({
    kind: "transition",
    status: "resolved",
    reason: "Comparable follow-up showed progress",
  });
  assert.equal(
    (
      await call("teacher-a", path + "/actions", {
        version: ticket.version,
        action: {
          kind: "transition",
          status: "closed",
          reason: "No acknowledgement yet",
        },
      })
    ).status,
    409,
  );
  await act({ kind: "feedback", feedback: "helpful" }, "child-a");
  await act(
    {
      kind: "transition",
      status: "closed",
      reason: "I understood the explanation",
    },
    "child-a",
  );
  const passport = await call("child-a", "/learner-passport/me");
  assert.equal(passport.data.items[0].outcome.improvementPp, 30);
  assert.equal(passport.data.learningDNA[0].state, "demonstrated");
  assert.equal(passport.data.items[0].question, undefined);
  assert.equal(passport.data.items[0].outcome.reviewedBy, undefined);
  assert.equal(
    (await call("teacher-a", "/organizations/1/support/accountability")).data
      .summary.measuredOutcomes,
    1,
  );
  assert.equal(
    (await call("child-b", "/learner-passport/me")).data.items.length,
    0,
  );
  await act({ kind: "feedback", feedback: "needs_more_help" }, "child-a");
  assert.equal(ticket.status, "in_progress");
  assert.equal(ticket.outcome, null);
  const version = ticket.version;
  const edits = await Promise.all([
    call("teacher-a", path + "/actions", {
      version,
      action: { kind: "reply", body: "First concurrent response" },
    }),
    call("teacher-a", path + "/actions", {
      version,
      action: { kind: "reply", body: "Second concurrent response" },
    }),
  ]);
  assert.deepEqual(edits.map((x) => x.status).sort(), [200, 409]);
  await engine.exec(
    `INSERT INTO learner_support_tickets(organization_id,course_id,learner_id,concept,question,attempted,request_key) SELECT 1,1,'child-a','Synthetic concept '||n,'Synthetic question for pagination','Synthetic attempt','pagination-'||n FROM generate_series(1,120) n`,
  );
  const first = await call("child-a", "/organizations/1/support");
  assert.equal(first.data.items.length, 50);
  assert.ok(first.data.nextCursor);
  const second = await call(
    "child-a",
    "/organizations/1/support?after=" + first.data.nextCursor,
  );
  assert.equal(second.data.items.length, 50);
  assert.ok(second.data.items.every((t: any) => t.id > first.data.nextCursor));
  const passportPage = await call("child-a", "/learner-passport/me");
  assert.equal(passportPage.data.items.length, 100);
  assert.ok(passportPage.data.nextCursor);
  console.log(
    "PASS: HTTP authentication, school isolation, course authorization, Botswana framework version, idempotency, optimistic concurrency, complete 42→72 success loop, evidence gating, learner acknowledgement, private passport, DNA review and reopening. Migration replay passed.",
  );
} finally {
  server.close();
  await engine.close();
}
