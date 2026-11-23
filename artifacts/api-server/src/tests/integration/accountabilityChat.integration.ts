// Synthetic two-school HTTP/database tests for accountability cases,
// escalation, class chat, jurisdiction rules and parent result notices.
// The database is generated from the real Drizzle schema; the new tables are
// then dropped and recreated from the reviewed SQL migrations so their CHECKs
// and the append-only trigger are exercised too.
// Bundle with @workspace/db aliased to supportTestDb.ts (scripts/test-accountability-chat.mjs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import express from "express";
import accountabilityRouter from "../../routes/accountability";
import classChatRouter from "../../routes/classChat";
import privacyRouter from "../../routes/privacy";
import { engine } from "./supportTestDb";
import { createSchemaFromDrizzle, syncSequences } from "./schemaFromDrizzle";
import { queueResultNotices } from "../../lib/resultNotices";
import { currentNoticeAuthorization } from "../../lib/currentNotificationAuthorization";
import { escalationDecision, caseView, effectiveRank, transitionAllowed, effectiveSeverity, initialLevel, responseMetrics } from "../../lib/accountabilityPolicy";
import { dailyEventId } from "../../lib/resultNotices";

const statementCount = await createSchemaFromDrizzle();
console.log(`# schema: ${statementCount} statements generated from lib/db/src/schema`);
await engine.exec(`DROP TABLE class_chat_mutes, class_chat_reports, class_chat_messages, class_chat_channels, accountability_case_events, accountability_cases CASCADE`);
for (const v of ["20261123_results_published_notices", "20261123_accountability_and_class_chat"]) {
  await engine.exec(readFileSync(`lib/db/migrations/${v}.sql`, "utf8"));
  console.log(`# applied reviewed migration ${v}`);
}

await engine.exec(`
INSERT INTO users(id,email,first_name,last_name) VALUES
 ('owner-1','owner1@school1.test','Olga','Owner'),('head-1','head1@school1.test','Hana','Head'),
 ('gradehead-1','gh1@school1.test','Gift','Gradehead'),('teacher-1','t1@school1.test','Tess','Teacher'),
 ('teacher-2','t2@school1.test','Theo','Teacher'),
 ('learner-1','l1@school1.test','Lerato','Mokoena'),('learner-2','l2@school1.test','Sipho','Khumalo'),
 ('learner-3','l3@school1.test','Anele','Radebe'),
 ('owner-2','owner2@school2.test','Two','Owner'),('learner-x','lx@school2.test','Kagiso','Other'),
 ('g-1','g1@family.test','Grace','Guardian'),('stranger','s@nowhere.test','Sam','Stranger');
INSERT INTO organizations(id,name,owner_id) VALUES (1,'Synthetic School 1','owner-1'),(2,'Synthetic School 2','owner-2');
INSERT INTO organization_members(organization_id,user_id,role) VALUES
 (1,'owner-1','owner'),(1,'head-1','teacher'),(1,'gradehead-1','teacher'),(1,'teacher-1','teacher'),(1,'teacher-2','teacher'),
 (1,'learner-1','learner'),(1,'learner-2','learner'),(1,'learner-3','learner'),(2,'owner-2','owner'),(2,'learner-x','learner');
INSERT INTO management_units(id,organization_id,parent_id,name,type,created_by) VALUES (1,1,NULL,'School 1','school','owner-1'),(2,1,1,'Grade 7','grade','owner-1');
INSERT INTO management_role_grants(organization_id,unit_id,user_id,role,granted_by) VALUES (1,1,'head-1','headmaster','owner-1'),(1,2,'gradehead-1','grade_head','owner-1');
INSERT INTO institution_setup(organization_id,institution_type,country_code,province,district,curriculum,academic_year,updated_by)
 VALUES (1,'public_school','ZA','Gauteng','Johannesburg','CAPS',2026,'owner-1');
INSERT INTO verified_enrollments(id,organization_id,learner_id,stage,academic_year,status,recorded_by) VALUES
 (1,1,'learner-1','Grade 7',2026,'active','owner-1'),(2,1,'learner-2','Grade 7',2026,'active','owner-1'),(3,2,'learner-x','Grade 7',2026,'active','owner-2');
INSERT INTO academic_courses(id,organization_id,name,code,level) VALUES (1,1,'Mathematics','MATH7','Grade 7'),(2,2,'Mathematics','MATH7','Grade 7');
INSERT INTO academic_periods(id,organization_id,name,year,begins_at) VALUES (1,1,'Term 1',2026,'2026-01-14');
INSERT INTO academic_assessments(id,organization_id,course_id,period_id,title,category,max_marks,weight,created_by) VALUES (1,1,1,1,'Fractions test','test',100,1,'teacher-1');
INSERT INTO academic_enrollments(course_id,user_id) VALUES (1,'learner-1'),(1,'learner-2'),(2,'learner-x');
INSERT INTO course_staff_assignments(organization_id,course_id,staff_id,assigned_by) VALUES (1,1,'teacher-1','owner-1');
INSERT INTO academic_grades(id,assessment_id,learner_id,marks,status,reviewed_by) VALUES (1,1,'learner-1',72,'published','teacher-1');
INSERT INTO guardian_relationships(id,learner_id,guardian_id,status) VALUES (1,'learner-1','g-1','verified');
INSERT INTO guardian_verification_events(relationship_id,organization_id,reviewed_by,decision) VALUES (1,1,'owner-1','verified');
`);
await syncSequences(["organizations", "management_units", "verified_enrollments", "academic_courses", "academic_periods", "academic_assessments", "academic_grades", "guardian_relationships"]);

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = req.headers["x-test-user"] ? ({ id: String(req.headers["x-test-user"]) } as any) : undefined;
  req.isAuthenticated = (() => !!req.user) as any;
  next();
});
app.use("/api", accountabilityRouter, classChatRouter, privacyRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(r => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
async function call(user: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; data: any }> {
  const res = await fetch(base + path, {
    method, headers: { ...(user ? { "x-test-user": user } : {}), ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const cases = (org = 1) => `/organizations/${org}/accountability/cases`;
async function rows(sql: string) { return (await engine.query(sql)).rows as any[]; }

let failures = 0, passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`ok - ${name}`); }
  catch (error) { failures++; console.log(`not ok - ${name}`); console.log(error); }
}

try {
  // ---------------------------------------------------------------- pure rules
  await check("escalation rules: overdue acknowledgement moves up, top level is flagged, finished cases rest", async () => {
    const t0 = new Date("2026-11-22T08:00:00Z"), later = new Date("2026-11-22T13:00:00Z");
    const open = { status: "open" as const, severity: "high" as const, escalationLevel: 0, acknowledgeDueAt: new Date("2026-11-22T12:00:00Z"), resolveDueAt: new Date("2026-11-25T08:00:00Z") };
    assert.equal(escalationDecision(open, t0).action, "none");
    const up = escalationDecision(open, later);
    assert.equal(up.action, "escalate");
    if (up.action === "escalate") { assert.equal(up.toLevel, 1); assert.equal(up.reason, "acknowledgement_overdue"); assert.ok(up.acknowledgeDueAt > later); }
    assert.equal(escalationDecision({ ...open, escalationLevel: 2 }, later).action, "overdue_at_top");
    assert.equal(escalationDecision({ ...open, status: "resolved" }, later).action, "none");
    assert.equal(escalationDecision({ ...open, status: "in_progress" }, later).action, "none", "acknowledged work is judged on resolution");
    assert.equal(escalationDecision({ ...open, status: "in_progress" }, new Date("2026-11-26T00:00:00Z")).action, "escalate");
  });
  await check("ranks, views, severity floors and status order", async () => {
    assert.equal(effectiveRank({ userId: "a", orgRole: "teacher", grants: ["grade_head"] }), 35);
    assert.equal(effectiveRank({ userId: "a", orgRole: "admin", grants: [] }), 60);
    assert.equal(effectiveRank({ userId: "a", orgRole: "learner", grants: ["made_up_role"] }), 0);
    const facts = { reporterId: "r", assignedTo: "o", subjectUserId: "s", escalationLevel: 1 };
    assert.equal(caseView({ userId: "o", orgRole: "teacher", grants: [] }, facts), "full", "owner");
    assert.equal(caseView({ userId: "x", orgRole: "teacher", grants: ["grade_head"] }, facts), "none", "below level 1");
    assert.equal(caseView({ userId: "x", orgRole: "teacher", grants: ["headmaster"] }, facts), "full");
    assert.equal(caseView({ userId: "s", orgRole: "owner", grants: [] }, facts), "none", "subject never sees it");
    assert.equal(caseView({ userId: "r", orgRole: "learner", grants: [] }, facts), "reporter");
    assert.equal(effectiveSeverity("safeguarding", "low"), "medium");
    assert.equal(effectiveSeverity("data_incident", "medium"), "high");
    assert.equal(initialLevel("safeguarding", "critical"), 1);
    assert.equal(initialLevel("conduct", "critical"), 0);
    assert.equal(transitionAllowed("open", "closed"), false);
    assert.equal(transitionAllowed("resolved", "closed"), true);
    assert.equal(transitionAllowed("closed", "in_progress"), false);
    const m = responseMetrics([{ assignedTo: "o", createdAt: new Date(0), acknowledgedAt: new Date(3_600_000), acknowledgeDueAt: new Date(7_200_000), resolvedAt: null, resolveDueAt: new Date(10_000), escalations: 0 }], new Date(20_000_000));
    assert.deepEqual([m[0].acknowledgedOnTime, m[0].overdueNow, m[0].medianHoursToAcknowledge], [1, 1, 1]);
  });
  await check("daily notice ids are stable per guardian, child, school and day, and valid UUIDs", async () => {
    const a = dailyEventId("g", "l", 1, "2026-11-22");
    assert.equal(a, dailyEventId("g", "l", 1, "2026-11-22"));
    assert.notEqual(a, dailyEventId("g", "l", 1, "2026-11-23"));
    assert.notEqual(a, dailyEventId("g", "l", 2, "2026-11-22"));
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  // ---------------------------------------------------------------- jurisdiction
  await check("the school's recorded country picks the rules; the device time zone only suggests", async () => {
    const me = await call("teacher-1", "GET", "/privacy/regimes/me", undefined, { "x-cabo-timezone": "Africa/Gaborone" });
    assert.equal(me.status, 200);
    assert.equal(me.data.suggestedCountry, "BW");
    const school = me.data.schools.find((s: any) => s.organizationId === 1);
    assert.equal(school.countryRecorded, true);
    assert.equal(school.regime.code, "ZA");
    assert.equal(school.regime.rules.childSelfConsentAge.value, null);
  });
  await check("a school without a recorded country gets the strictest of both regimes", async () => {
    const r = await call("owner-2", "GET", "/organizations/2/accountability/regime");
    assert.equal(r.status, 200);
    assert.equal(r.data.code, "UNSET");
    assert.equal(r.data.rules.childSelfConsentAge.value, null);
    assert.equal(r.data.rules.breachRegulatorHours.value, 72);
    assert.equal(r.data.rules.localCopyOnTransfer.value, true);
    assert.equal((await call("stranger", "GET", "/organizations/2/accountability/regime")).status, 404);
  });

  // ---------------------------------------------------------------- cases
  let learnerCase = 0;
  await check("a learner's concern is raised, floored to medium and owned by the nearest qualified lead", async () => {
    const r = await call("learner-1", "POST", cases(), { kind: "safeguarding", severity: "low", summary: "Someone keeps messaging me after school." });
    assert.equal(r.status, 201);
    assert.equal(r.data.view, "reporter");
    assert.equal(r.data.severity, "medium");
    assert.equal(r.data.summary, undefined, "the reporter view does not echo case detail");
    learnerCase = r.data.id;
    const [row] = await rows(`SELECT assigned_to, escalation_level, jurisdiction FROM accountability_cases WHERE id=${learnerCase}`);
    assert.deepEqual(row, { assigned_to: "gradehead-1", escalation_level: 0, jurisdiction: "ZA" });
  });
  await check("only handlers at the case's level and the reporter can see it", async () => {
    const mine = await call("learner-1", "GET", cases());
    assert.deepEqual(mine.data.map((c: any) => [c.id, c.view]), [[learnerCase, "reporter"]]);
    assert.deepEqual((await call("teacher-2", "GET", cases())).data, []);
    assert.equal((await call("learner-2", "GET", `${cases()}/${learnerCase}`)).status, 404);
    assert.equal((await call("stranger", "GET", cases())).status, 404);
    assert.equal((await call("owner-2", "GET", `${cases()}/${learnerCase}`)).status, 404, "another school's owner");
    const full = await call("gradehead-1", "GET", `${cases()}/${learnerCase}`);
    assert.equal(full.data.view, "full");
    assert.equal(full.data.events[0].action, "created");
  });
  await check("the person a case is about cannot see or handle it, even with rank", async () => {
    const r = await call("owner-1", "POST", cases(), { kind: "conduct", severity: "medium", summary: "Complaint about how a staff member spoke to a class.", subjectUserId: "head-1" });
    assert.equal(r.status, 201);
    const [row] = await rows(`SELECT assigned_to FROM accountability_cases WHERE id=${r.data.id}`);
    assert.notEqual(row.assigned_to, "head-1");
    assert.equal((await call("head-1", "GET", `${cases()}/${r.data.id}`)).status, 404);
    assert.equal((await call("owner-1", "POST", cases(), { kind: "conduct", severity: "low", summary: "Subject from another school.", subjectUserId: "learner-x" })).status, 400);
  });
  await check("data incidents: staff only, start at leadership and carry the country's regulator clock", async () => {
    assert.equal((await call("learner-1", "POST", cases(), { kind: "data_incident", severity: "high", summary: "I saw other learners' marks." })).status, 403);
    const aware = "2026-11-20T08:00:00.000Z";
    const r = await call("teacher-1", "POST", cases(), { kind: "data_incident", severity: "medium", summary: "Mark sheet emailed to the wrong parent group.", awareAt: aware });
    assert.equal(r.status, 201);
    assert.equal(r.data.severity, "high");
    const [row] = await rows(`SELECT escalation_level, assigned_to, regulator_due_at FROM accountability_cases WHERE id=${r.data.id}`);
    assert.equal(row.escalation_level, 1);
    assert.ok(["owner-1", "head-1"].includes(row.assigned_to));
    assert.equal(new Date(row.regulator_due_at).toISOString(), "2026-11-23T08:00:00.000Z");
    const owner = row.assigned_to;
    assert.equal((await call(owner, "POST", `${cases()}/${r.data.id}/actions`, { action: "regulator_notified", note: "Reported online to the Information Regulator." })).status, 200);
    assert.equal((await call(owner, "POST", `${cases()}/${r.data.id}/actions`, { action: "regulator_notified", note: "Again." })).status, 409);
    assert.equal((await call(owner, "POST", `${cases()}/${learnerCase}/actions`, { action: "regulator_notified", note: "Not an incident." })).status, 400);
  });
  await check("handlers must follow the status order and explain resolutions", async () => {
    assert.equal((await call("teacher-2", "POST", `${cases()}/${learnerCase}/actions`, { action: "acknowledge" })).status, 404);
    assert.equal((await call("gradehead-1", "POST", `${cases()}/${learnerCase}/actions`, { action: "close", note: "Closing now." })).status, 409);
    assert.equal((await call("gradehead-1", "POST", `${cases()}/${learnerCase}/actions`, { action: "acknowledge" })).status, 200);
    assert.equal((await call("gradehead-1", "POST", `${cases()}/${learnerCase}/actions`, { action: "resolve" })).status, 400);
  });
  await check("a missed deadline escalates automatically and is counted against the owner", async () => {
    const r = await call("teacher-1", "POST", cases(), { kind: "service", severity: "high", summary: "Timetable shows the wrong exam room for Grade 7." });
    await engine.exec(`UPDATE accountability_cases SET acknowledge_due_at = now() - interval '1 minute' WHERE id=${r.data.id}`);
    const [before] = await rows(`SELECT assigned_to FROM accountability_cases WHERE id=${r.data.id}`);
    assert.equal(before.assigned_to, "gradehead-1");
    await call("head-1", "GET", cases());
    const [after] = await rows(`SELECT escalation_level, assigned_to, acknowledge_due_at > now() AS fresh FROM accountability_cases WHERE id=${r.data.id}`);
    assert.equal(after.escalation_level, 1);
    assert.ok(["owner-1", "head-1"].includes(after.assigned_to));
    assert.equal(after.fresh, true);
    const events = await rows(`SELECT action, note FROM accountability_case_events WHERE case_id=${r.data.id} ORDER BY id`);
    assert.ok(events.some(e => e.action === "escalated" && /missed by gradehead-1/.test(e.note)));
    const dash = await call("head-1", "GET", "/organizations/1/accountability/dashboard");
    assert.equal(dash.status, 200);
    assert.equal(dash.data.people.find((p: any) => p.userId === "gradehead-1").escalations, 1);
    assert.equal(dash.data.regime.code, "ZA");
    assert.equal((await call("teacher-1", "GET", "/organizations/1/accountability/dashboard")).status, 404);
    // Running the sweep again does not escalate the same miss twice.
    await call("head-1", "GET", cases());
    const [again] = await rows(`SELECT escalation_level FROM accountability_cases WHERE id=${r.data.id}`);
    assert.equal(again.escalation_level, 1);
  });
  await check("the case history cannot be edited", async () => {
    await assert.rejects(engine.exec(`UPDATE accountability_case_events SET note='rewritten' WHERE case_id=${learnerCase}`), /append-only/);
  });
  await check("a verified guardian can raise a concern about their own child only", async () => {
    assert.equal((await call("g-1", "POST", cases(), { kind: "safeguarding", severity: "high", summary: "My child says older learners take her lunch.", subjectUserId: "learner-1" })).status, 201);
    assert.equal((await call("g-1", "POST", cases(), { kind: "safeguarding", severity: "high", summary: "Concern about another child.", subjectUserId: "learner-2" })).status, 400);
    assert.equal((await call("stranger", "POST", cases(), { kind: "safeguarding", severity: "high", summary: "Not connected to this school." })).status, 403);
  });

  // ---------------------------------------------------------------- chat
  let channel = 0;
  await check("only assigned staff and leaders open a course channel; learners see it once open", async () => {
    assert.deepEqual((await call("learner-1", "GET", "/organizations/1/chat/channels")).data.channels, []);
    const staff = await call("teacher-1", "GET", "/organizations/1/chat/channels");
    assert.deepEqual(staff.data.channels.map((c: any) => [c.courseId, c.status, c.moderator]), [[1, "not_started", true]]);
    assert.equal(staff.data.retentionDays, 365);
    assert.deepEqual((await call("teacher-2", "GET", "/organizations/1/chat/channels")).data.channels, []);
    assert.equal((await call("learner-1", "PUT", "/organizations/1/chat/courses/1/channel", { status: "open" })).status, 404);
    assert.equal((await call("owner-2", "PUT", "/organizations/2/chat/courses/1/channel", { status: "open" })).status, 404, "course of another school");
    const open = await call("teacher-1", "PUT", "/organizations/1/chat/courses/1/channel", { status: "open" });
    assert.equal(open.status, 200);
    channel = open.data.channelId;
    assert.equal((await call("learner-1", "GET", "/organizations/1/chat/channels")).data.channels[0].channelId, channel);
  });
  const msgs = () => `/organizations/1/chat/channels/${channel}/messages`;
  await check("classmates see a first name and initial, never an account id", async () => {
    assert.equal((await call("learner-1", "POST", msgs(), { body: "Hello class, who finished question 4?" })).status, 201);
    const seen = await call("learner-2", "GET", msgs());
    assert.equal(seen.data.messages[0].author, "Lerato M.");
    assert.equal(seen.data.messages[0].authorId, undefined);
    assert.equal((await call("learner-3", "GET", msgs())).status, 404, "same school, not in the course");
    assert.equal((await call("owner-2", "GET", "/organizations/2/chat/channels/" + channel + "/messages")).status, 404);
  });
  let heldId = 0;
  await check("contact details are held for the teacher and open a safeguarding case", async () => {
    const r = await call("learner-1", "POST", msgs(), { body: "add me on whatsapp 071 234 5678" });
    assert.equal(r.data.status, "held");
    heldId = r.data.id;
    assert.ok(!(await call("learner-2", "GET", msgs())).data.messages.some((m: any) => m.id === heldId));
    const own = (await call("learner-1", "GET", msgs())).data.messages.find((m: any) => m.id === heldId);
    assert.match(own.notice, /teacher/);
    const teacher = (await call("teacher-1", "GET", msgs())).data.messages.find((m: any) => m.id === heldId);
    assert.equal(teacher.screenReason, "off_platform_invite");
    const [c] = await rows(`SELECT kind, severity, subject_user_id, reporter_id FROM accountability_cases WHERE source_message_id=${heldId}`);
    assert.deepEqual(c, { kind: "safeguarding", severity: "high", subject_user_id: "learner-1", reporter_id: null });
  });
  await check("teacher decisions are recorded on the linked case", async () => {
    assert.equal((await call("learner-2", "POST", `${msgs()}/${heldId}/moderate`, { action: "approve", reason: "fine" })).status, 404);
    assert.equal((await call("teacher-1", "POST", `${msgs()}/${heldId}/moderate`, { action: "hide", reason: "Shared a phone number" })).status, 200);
    const notes = await rows(`SELECT e.note FROM accountability_case_events e JOIN accountability_cases c ON c.id=e.case_id WHERE c.source_message_id=${heldId} AND e.action='note'`);
    assert.match(notes[0].note, /hidden in class chat: Shared a phone number/);
  });
  await check("reports open one case per message and urgent reports hide the message", async () => {
    const posted = await call("learner-1", "POST", msgs(), { body: "You are so slow at maths." });
    const id = posted.data.id;
    assert.equal((await call("learner-2", "POST", `${msgs()}/${id}/report`, { reason: "bullying" })).status, 202);
    assert.equal((await call("learner-2", "POST", `${msgs()}/${id}/report`, { reason: "bullying" })).status, 202);
    assert.equal((await call("teacher-1", "POST", `${msgs()}/${id}/report`, { reason: "unsafe_contact" })).status, 202);
    const linked = await rows(`SELECT kind FROM accountability_cases WHERE source_message_id=${id}`);
    assert.deepEqual(linked, [{ kind: "chat_report" }]);
    const [m] = await rows(`SELECT status FROM class_chat_messages WHERE id=${id}`);
    assert.equal(m.status, "held");
    assert.equal((await call("learner-3", "POST", `${msgs()}/${id}/report`, { reason: "bullying" })).status, 404);
  });
  await check("teachers can pause a learner; paused learners cannot post", async () => {
    assert.equal((await call("teacher-1", "PUT", `/organizations/1/chat/channels/${channel}/mutes/teacher-2`, { minutes: 10, reason: "test" })).status, 400);
    assert.equal((await call("teacher-1", "PUT", `/organizations/1/chat/channels/${channel}/mutes/learner-2`, { minutes: 10, reason: "Off-topic spam" })).status, 200);
    assert.equal((await call("learner-2", "POST", msgs(), { body: "hi" })).status, 403);
    assert.equal((await call("learner-2", "GET", msgs())).data.canPost, false);
    assert.equal((await call("teacher-1", "DELETE", `/organizations/1/chat/channels/${channel}/mutes/learner-2`)).status, 200);
    assert.equal((await call("learner-2", "POST", msgs(), { body: "thanks" })).status, 201);
  });
  await check("posting is rate limited", async () => {
    let last = 0;
    for (let i = 0; i < 9; i++) last = (await call("learner-2", "POST", msgs(), { body: `line ${i}` })).status;
    assert.equal(last, 429);
  });
  await check("a closed channel stops learners but lets staff explain", async () => {
    await call("teacher-1", "PUT", "/organizations/1/chat/courses/1/channel", { status: "closed" });
    assert.equal((await call("learner-1", "POST", msgs(), { body: "anyone?" })).status, 403);
    assert.equal((await call("teacher-1", "POST", msgs(), { body: "Chat is closed for exams." })).status, 201);
  });

  // ---------------------------------------------------------------- result notices
  await check("result notices: opt-in, one per day, re-authorized against live records", async () => {
    process.env.CABO_NOTIFICATION_OUTBOX_ENABLED = "true";
    process.env.CABO_NOTIFICATION_OUTBOX_KEY = randomBytes(32).toString("base64");
    assert.deepEqual(await queueResultNotices(1, 1, "learner-1"), { queued: 0, skipped: 1 }, "not opted in");
    await engine.exec(`INSERT INTO notification_preferences(user_id,organization_id,kind,opted_in,confirmed_at) VALUES ('g-1',1,'results_published',true,now())`);
    assert.deepEqual(await queueResultNotices(1, 1, "learner-1"), { queued: 1, skipped: 0 });
    assert.deepEqual(await queueResultNotices(1, 1, "learner-1"), { queued: 0, skipped: 1 }, "same day is a duplicate");
    const [row] = await rows(`SELECT o.kind, s.source_kind, s.source_id, o.recipient_ciphertext NOT LIKE '%@%' AS encrypted, o.event_id::text AS event_id FROM notification_outbox o JOIN notification_event_sources s ON s.event_id=o.event_id`);
    assert.deepEqual([row.kind, row.source_kind, row.source_id, row.encrypted], ["results_published", "academic_grade", 1, true]);
    const ask = { eventId: row.event_id, recipientUserId: "g-1", organizationId: 1, kind: "results_published" as const, to: "g1@family.test" };
    assert.equal(await currentNoticeAuthorization(ask), true);
    assert.equal(await currentNoticeAuthorization({ ...ask, organizationId: 2 }), false, "other school");
    assert.equal(await currentNoticeAuthorization({ ...ask, to: "attacker@evil.test" }), false, "address changed");
    await engine.exec(`UPDATE academic_grades SET status='draft' WHERE id=1`);
    assert.equal(await currentNoticeAuthorization(ask), false, "result withdrawn before sending");
    await engine.exec(`UPDATE academic_grades SET status='published' WHERE id=1`);
    await engine.exec(`INSERT INTO guardian_verification_events(relationship_id,organization_id,reviewed_by,decision,created_at) VALUES (1,1,'owner-1','revoked',now()+interval '1 second')`);
    assert.equal(await currentNoticeAuthorization(ask), false, "school revoked the guardian");
  });
} finally {
  server.close();
  await engine.close();
}
console.log(`# accountability and chat integration: ${passed} passed, ${failures} failed`);
if (failures > 0) process.exitCode = 1;
