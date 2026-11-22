// Teacher-moderated class chat. One channel per academic course; no direct
// messages. Every route is scoped to one school, and every participant check
// is made on the server from enrolment, staff assignment and management rank.
import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, usersTable, academicCoursesTable, courseEnrollmentsTable, courseStaffAssignmentsTable,
  classChatChannelsTable, classChatMessagesTable, classChatReportsTable, classChatMutesTable,
  accountabilityCasesTable,
} from "@workspace/db";
import {
  REPORT_REASONS, displayName, mayModerate, mayPost, mayRead, messageVisibleTo, normaliseBody, screenMessage,
  screenNeedsCase, withinRateLimit, RATE_LIMIT, type ChatParticipant,
} from "../lib/classChatPolicy";
import { effectiveRank } from "../lib/accountabilityPolicy";
import { leadershipRanks } from "../lib/hierarchyPolicy";
import { memberContext, regimeForOrganization } from "../lib/schoolMembership";
import { openCase, recordEvent } from "../lib/accountabilityService";

const router: IRouter = Router();
const positive = z.coerce.number().int().positive();

function signedIn(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Sign in required" }); return null; }
  return req.user!.id;
}

async function participant(organizationId: number, courseId: number, userId: string): Promise<ChatParticipant & { leader: boolean }> {
  const ctx = await memberContext(organizationId, userId);
  const [course] = await db.select({ id: academicCoursesTable.id }).from(academicCoursesTable)
    .where(and(eq(academicCoursesTable.id, courseId), eq(academicCoursesTable.organizationId, organizationId))).limit(1);
  if (!course || (!ctx.orgRole && !ctx.superadmin)) return { isLearner: false, isAssignedStaff: false, isSchoolLeader: false, leader: false };
  const [enrolled, assigned] = await Promise.all([
    db.select({ id: courseEnrollmentsTable.id }).from(courseEnrollmentsTable)
      .where(and(eq(courseEnrollmentsTable.courseId, courseId), eq(courseEnrollmentsTable.userId, userId))).limit(1),
    db.select({ courseId: courseStaffAssignmentsTable.courseId }).from(courseStaffAssignmentsTable)
      .where(and(eq(courseStaffAssignmentsTable.organizationId, organizationId), eq(courseStaffAssignmentsTable.courseId, courseId), eq(courseStaffAssignmentsTable.staffId, userId))).limit(1),
  ]);
  const leader = !!ctx.superadmin || effectiveRank(ctx) >= leadershipRanks.head_of_department;
  const staffRole = ["owner", "admin", "teacher", "assessor"].includes(ctx.orgRole ?? "");
  return { isLearner: !!enrolled.length && !staffRole, isAssignedStaff: !!assigned.length && staffRole, isSchoolLeader: leader, leader };
}

async function channelFor(organizationId: number, channelId: number) {
  const [channel] = await db.select().from(classChatChannelsTable)
    .where(and(eq(classChatChannelsTable.id, channelId), eq(classChatChannelsTable.organizationId, organizationId))).limit(1);
  return channel ?? null;
}

/** Courses the caller can chat in, with channel state. */
router.get("/organizations/:orgId/chat/channels", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId); if (!org.success) { res.sendStatus(400); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const ctx = await memberContext(org.data, userId);
  if (!ctx.orgRole && !ctx.superadmin) { res.sendStatus(404); return; }
  const leader = !!ctx.superadmin || effectiveRank(ctx) >= leadershipRanks.head_of_department;
  const staffRole = ["owner", "admin", "teacher", "assessor"].includes(ctx.orgRole ?? "");
  const courses = await db.select({ id: academicCoursesTable.id, name: academicCoursesTable.name }).from(academicCoursesTable)
    .where(eq(academicCoursesTable.organizationId, org.data)).limit(500);
  const ids = courses.map(c => c.id);
  if (!ids.length) { res.json({ channels: [], retentionDays: (await regimeForOrganization(org.data)).chatRetentionDays.value }); return; }
  const [enrolled, assigned, channels] = await Promise.all([
    db.select({ courseId: courseEnrollmentsTable.courseId }).from(courseEnrollmentsTable).where(and(eq(courseEnrollmentsTable.userId, userId), inArray(courseEnrollmentsTable.courseId, ids))),
    db.select({ courseId: courseStaffAssignmentsTable.courseId }).from(courseStaffAssignmentsTable).where(and(eq(courseStaffAssignmentsTable.organizationId, org.data), eq(courseStaffAssignmentsTable.staffId, userId))),
    db.select().from(classChatChannelsTable).where(eq(classChatChannelsTable.organizationId, org.data)),
  ]);
  const enrolledIds = new Set(enrolled.map(e => e.courseId)), assignedIds = new Set(assigned.map(a => a.courseId));
  const byCourse = new Map(channels.map(c => [c.courseId, c]));
  const list = courses.map(c => {
    const p: ChatParticipant = { isLearner: enrolledIds.has(c.id) && !staffRole, isAssignedStaff: assignedIds.has(c.id) && staffRole, isSchoolLeader: leader };
    const channel = byCourse.get(c.id);
    if (!mayRead(p) || (!channel && !mayModerate(p))) return null;
    return { courseId: c.id, course: c.name, channelId: channel?.id ?? null, status: channel?.status ?? "not_started", moderator: mayModerate(p) };
  }).filter(Boolean);
  res.json({ channels: list, retentionDays: (await regimeForOrganization(org.data)).chatRetentionDays.value });
});

/** Staff open or close a course channel. */
router.put("/organizations/:orgId/chat/courses/:courseId/channel", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId), course = positive.safeParse(req.params.courseId);
  const body = z.object({ status: z.enum(["open", "closed"]) }).safeParse(req.body);
  if (!org.success || !course.success || !body.success) { res.sendStatus(400); return; }
  const p = await participant(org.data, course.data, userId);
  if (!mayModerate(p)) { res.sendStatus(404); return; }
  const [channel] = await db.insert(classChatChannelsTable).values({ organizationId: org.data, courseId: course.data, status: body.data.status, createdBy: userId })
    .onConflictDoUpdate({ target: classChatChannelsTable.courseId, set: { status: body.data.status } }).returning();
  res.json({ channelId: channel.id, status: channel.status });
});

router.get("/organizations/:orgId/chat/channels/:channelId/messages", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId), id = positive.safeParse(req.params.channelId);
  const after = z.coerce.number().int().min(0).safeParse(req.query.after ?? 0);
  if (!org.success || !id.success || !after.success) { res.sendStatus(400); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const channel = await channelFor(org.data, id.data);
  if (!channel) { res.sendStatus(404); return; }
  const p = await participant(org.data, channel.courseId, userId);
  if (!mayRead(p)) { res.sendStatus(404); return; }
  const moderator = mayModerate(p);
  const rows = after.data > 0
    ? await db.select().from(classChatMessagesTable).where(and(eq(classChatMessagesTable.channelId, channel.id), gt(classChatMessagesTable.id, after.data))).orderBy(asc(classChatMessagesTable.id)).limit(100)
    : (await db.select().from(classChatMessagesTable).where(eq(classChatMessagesTable.channelId, channel.id)).orderBy(desc(classChatMessagesTable.id)).limit(100)).reverse();
  const authorIds = [...new Set(rows.map(r => r.authorId).filter((x): x is string => !!x))];
  const people = authorIds.length ? await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable).where(inArray(usersTable.id, authorIds)) : [];
  const staffIds = authorIds.length ? new Set((await db.select({ staffId: courseStaffAssignmentsTable.staffId }).from(courseStaffAssignmentsTable)
    .where(and(eq(courseStaffAssignmentsTable.organizationId, org.data), eq(courseStaffAssignmentsTable.courseId, channel.courseId), inArray(courseStaffAssignmentsTable.staffId, authorIds)))).map(s => s.staffId)) : new Set<string>();
  const nameOf = new Map(people.map(u => [u.id, displayName(u.firstName, u.lastName, staffIds.has(u.id))]));
  const [mute] = await db.select({ until: classChatMutesTable.until }).from(classChatMutesTable)
    .where(and(eq(classChatMutesTable.channelId, channel.id), eq(classChatMutesTable.userId, userId))).limit(1);
  const now = new Date();
  res.json({
    channelId: channel.id, status: channel.status, moderator,
    canPost: mayPost(p, channel.status === "open", mute?.until ?? null, now),
    mutedUntil: mute && mute.until > now ? mute.until : null,
    messages: rows.flatMap(m => {
      const v = messageVisibleTo(m, userId, moderator);
      if (v === "hidden") return [];
      return [{
        id: m.id, author: m.authorId ? nameOf.get(m.authorId) ?? "Former member" : "Former member",
        mine: m.authorId === userId, body: m.body, createdAt: m.createdAt, status: m.status,
        ...(moderator ? { authorId: m.authorId, screenReason: m.screenReason, moderationReason: m.moderationReason } : {}),
        ...(v === "own_held" ? { notice: "Waiting for your teacher to check this message before classmates can see it." } : {}),
      }];
    }),
  });
});

router.post("/organizations/:orgId/chat/channels/:channelId/messages", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId), id = positive.safeParse(req.params.channelId);
  const body = normaliseBody(req.body?.body);
  if (!org.success || !id.success) { res.sendStatus(400); return; }
  if (!body) { res.status(400).json({ error: "Messages must be between 1 and 1000 characters." }); return; }
  const channel = await channelFor(org.data, id.data);
  if (!channel) { res.sendStatus(404); return; }
  const p = await participant(org.data, channel.courseId, userId);
  if (!mayRead(p)) { res.sendStatus(404); return; }
  const now = new Date();
  const [mute] = await db.select({ until: classChatMutesTable.until }).from(classChatMutesTable)
    .where(and(eq(classChatMutesTable.channelId, channel.id), eq(classChatMutesTable.userId, userId))).limit(1);
  if (!mayPost(p, channel.status === "open", mute?.until ?? null, now)) {
    res.status(403).json({ error: channel.status !== "open" ? "This class chat is closed." : "You are paused from posting in this class chat." }); return;
  }
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(classChatMessagesTable).where(and(
    eq(classChatMessagesTable.channelId, channel.id), eq(classChatMessagesTable.authorId, userId),
    gte(classChatMessagesTable.createdAt, new Date(now.getTime() - RATE_LIMIT.windowSeconds * 1000))));
  if (!withinRateLimit(Number(recent?.n ?? 0))) { res.setHeader("Retry-After", String(RATE_LIMIT.windowSeconds)); res.status(429).json({ error: "Slow down a little before sending more messages." }); return; }
  // Staff messages are not screened; learner messages may be held for review.
  const screen = mayModerate(p) ? { status: "visible" as const } : screenMessage(body);
  const [message] = await db.insert(classChatMessagesTable).values({
    channelId: channel.id, organizationId: org.data, authorId: userId, body,
    status: screen.status, screenReason: screen.status === "held" ? screen.reason : null,
  }).returning();
  if (screen.status === "held") {
    const needsCase = screenNeedsCase(screen.reason);
    if (needsCase) await openCase({
      organizationId: org.data, kind: needsCase.kind, severity: needsCase.severity, reporterId: null,
      subjectUserId: userId, sourceMessageId: message.id,
      summary: `Class chat message held automatically (${screen.reason.replace(/_/g, " ")}). Review the message in the class chat moderation view.`,
    });
  }
  res.status(201).json({ id: message.id, status: message.status, notice: screen.status === "held" ? "Your teacher will check this message before classmates can see it." : null });
});

router.post("/organizations/:orgId/chat/channels/:channelId/messages/:messageId/moderate", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId), id = positive.safeParse(req.params.channelId), mid = positive.safeParse(req.params.messageId);
  const body = z.object({ action: z.enum(["approve", "hide"]), reason: z.string().trim().min(3).max(500) }).safeParse(req.body);
  if (!org.success || !id.success || !mid.success || !body.success) { res.status(400).json({ error: "Give a short reason for the moderation decision." }); return; }
  const channel = await channelFor(org.data, id.data);
  if (!channel) { res.sendStatus(404); return; }
  const p = await participant(org.data, channel.courseId, userId);
  if (!mayModerate(p)) { res.sendStatus(404); return; }
  const updated = await db.update(classChatMessagesTable).set({
    status: body.data.action === "approve" ? "visible" : "hidden", moderatedBy: userId, moderatedAt: new Date(), moderationReason: body.data.reason,
  }).where(and(eq(classChatMessagesTable.id, mid.data), eq(classChatMessagesTable.channelId, channel.id))).returning({ id: classChatMessagesTable.id });
  if (!updated.length) { res.sendStatus(404); return; }
  // Moderation of a message under an open case is recorded on that case too.
  const cases = await db.select({ id: accountabilityCasesTable.id }).from(accountabilityCasesTable)
    .where(and(eq(accountabilityCasesTable.organizationId, org.data), eq(accountabilityCasesTable.sourceMessageId, mid.data))).limit(5);
  for (const c of cases) await recordEvent(db, { caseId: c.id, organizationId: org.data, actorId: userId, action: "note", note: `Message ${body.data.action === "approve" ? "approved" : "hidden"} in class chat: ${body.data.reason}` });
  res.json({ ok: true });
});

router.post("/organizations/:orgId/chat/channels/:channelId/messages/:messageId/report", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId), id = positive.safeParse(req.params.channelId), mid = positive.safeParse(req.params.messageId);
  const body = z.object({ reason: z.enum(REPORT_REASONS) }).safeParse(req.body);
  if (!org.success || !id.success || !mid.success || !body.success) { res.sendStatus(400); return; }
  const channel = await channelFor(org.data, id.data);
  if (!channel) { res.sendStatus(404); return; }
  const p = await participant(org.data, channel.courseId, userId);
  if (!mayRead(p)) { res.sendStatus(404); return; }
  const [message] = await db.select().from(classChatMessagesTable)
    .where(and(eq(classChatMessagesTable.id, mid.data), eq(classChatMessagesTable.channelId, channel.id))).limit(1);
  if (!message || messageVisibleTo(message, userId, mayModerate(p)) === "hidden") { res.sendStatus(404); return; }
  const [report] = await db.insert(classChatReportsTable).values({ messageId: message.id, reporterId: userId, reason: body.data.reason })
    .onConflictDoNothing().returning();
  // Same answer whether or not this person already reported the message.
  if (!report) { res.status(202).json({ received: true }); return; }
  const urgent = body.data.reason === "unsafe_contact" || body.data.reason === "self_harm_concern";
  if (urgent && message.status === "visible") await db.update(classChatMessagesTable).set({ status: "held", screenReason: "reported_" + body.data.reason })
    .where(eq(classChatMessagesTable.id, message.id));
  const [existing] = await db.select({ id: accountabilityCasesTable.id }).from(accountabilityCasesTable)
    .where(and(eq(accountabilityCasesTable.organizationId, org.data), eq(accountabilityCasesTable.sourceMessageId, message.id))).limit(1);
  let caseId = existing?.id;
  if (existing) {
    await recordEvent(db, { caseId: existing.id, organizationId: org.data, actorId: userId, action: "note", note: `Another report: ${body.data.reason.replace(/_/g, " ")}` });
  } else {
    const row = await openCase({
      organizationId: org.data, kind: "chat_report", severity: urgent ? "high" : "medium", reporterId: userId,
      subjectUserId: message.authorId, sourceMessageId: message.id,
      summary: `Class chat message reported for ${body.data.reason.replace(/_/g, " ")}. Review it in the class chat moderation view.`,
    });
    caseId = row.id;
  }
  await db.update(classChatReportsTable).set({ caseId }).where(eq(classChatReportsTable.id, report.id));
  res.status(202).json({ received: true });
});

router.put("/organizations/:orgId/chat/channels/:channelId/mutes/:userId", async (req, res) => {
  const actor = signedIn(req, res); if (!actor) return;
  const org = positive.safeParse(req.params.orgId), id = positive.safeParse(req.params.channelId);
  const body = z.object({ minutes: z.number().int().min(10).max(7 * 24 * 60), reason: z.string().trim().min(3).max(500) }).safeParse(req.body);
  const target = z.string().min(1).max(160).safeParse(req.params.userId);
  if (!org.success || !id.success || !body.success || !target.success) { res.status(400).json({ error: "Choose a pause length and give a reason." }); return; }
  const channel = await channelFor(org.data, id.data);
  if (!channel) { res.sendStatus(404); return; }
  const p = await participant(org.data, channel.courseId, actor);
  if (!mayModerate(p)) { res.sendStatus(404); return; }
  const t = await participant(org.data, channel.courseId, target.data);
  if (!t.isLearner) { res.status(400).json({ error: "Only learners in this class can be paused." }); return; }
  const until = new Date(Date.now() + body.data.minutes * 60_000);
  await db.insert(classChatMutesTable).values({ channelId: channel.id, userId: target.data, mutedBy: actor, reason: body.data.reason, until })
    .onConflictDoUpdate({ target: [classChatMutesTable.channelId, classChatMutesTable.userId], set: { mutedBy: actor, reason: body.data.reason, until, createdAt: new Date() } });
  res.json({ mutedUntil: until });
});

router.delete("/organizations/:orgId/chat/channels/:channelId/mutes/:userId", async (req, res) => {
  const actor = signedIn(req, res); if (!actor) return;
  const org = positive.safeParse(req.params.orgId), id = positive.safeParse(req.params.channelId);
  if (!org.success || !id.success) { res.sendStatus(400); return; }
  const channel = await channelFor(org.data, id.data);
  if (!channel) { res.sendStatus(404); return; }
  const p = await participant(org.data, channel.courseId, actor);
  if (!mayModerate(p)) { res.sendStatus(404); return; }
  await db.delete(classChatMutesTable).where(and(eq(classChatMutesTable.channelId, channel.id), eq(classChatMutesTable.userId, String(req.params.userId))));
  res.json({ ok: true });
});

export default router;
