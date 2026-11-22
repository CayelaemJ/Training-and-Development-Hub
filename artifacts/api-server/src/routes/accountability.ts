// Accountability cases and escalation. Every route is scoped to one school
// (/organizations/:orgId/...), so the country pilot gate applies, and every
// decision about who may see or act on a case is made on the server from the
// caller's membership and management grants (lib/accountabilityPolicy.ts).
import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable, accountabilityCasesTable, accountabilityCaseEventsTable } from "@workspace/db";
import {
  CASE_KINDS, SEVERITIES, LEVELS, caseView, mayHandle, mayRaise, responseMetrics, transitionAllowed, effectiveRank,
  type CaseKind, type CaseStatus,
} from "../lib/accountabilityPolicy";
import { leadershipRanks } from "../lib/hierarchyPolicy";
import { memberContext, isVerifiedGuardianAt, regimeForOrganization } from "../lib/schoolMembership";
import { openCase, recordEvent, sweepOverdue, chooseOwner } from "../lib/accountabilityService";
import { describeRegime } from "../lib/jurisdictionPolicy";
import { auditSuperadmin } from "../lib/platformAudit";

const router: IRouter = Router();
const positive = z.coerce.number().int().positive();

function signedIn(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Sign in required" }); return null; }
  return req.user!.id;
}

const createBody = z.object({
  kind: z.enum(CASE_KINDS.filter(k => k !== "chat_report") as [CaseKind, ...CaseKind[]]),
  severity: z.enum(SEVERITIES),
  summary: z.string().trim().min(10).max(2000),
  subjectUserId: z.string().trim().min(1).max(160).optional(),
  awareAt: z.coerce.date().optional(),
});

const actionBody = z.object({
  action: z.enum(["acknowledge", "start", "resolve", "close", "reopen", "note", "assign", "regulator_notified"]),
  note: z.string().trim().max(2000).default(""),
  assignee: z.string().trim().min(1).max(160).optional(),
});

/** Reporter view: enough to know the case is being handled, nothing about others. */
function reporterProjection(c: typeof accountabilityCasesTable.$inferSelect) {
  return {
    id: c.id, kind: c.kind, severity: c.severity, status: c.status, view: "reporter" as const,
    escalationLevel: c.escalationLevel, levelTitle: LEVELS[Math.min(c.escalationLevel, LEVELS.length - 1)].title,
    acknowledged: c.acknowledgedAt !== null, createdAt: c.createdAt, resolvedAt: c.resolvedAt,
  };
}

async function names(ids: readonly (string | null)[]) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return new Map<string, string>();
  const rows = await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable).where(inArray(usersTable.id, wanted));
  return new Map(rows.map(r => [r.id, [r.firstName, r.lastName].filter(Boolean).join(" ") || "Staff member"]));
}

function fullProjection(c: typeof accountabilityCasesTable.$inferSelect, who: Map<string, string>, now: Date) {
  return {
    ...c, view: "full" as const,
    levelTitle: LEVELS[Math.min(c.escalationLevel, LEVELS.length - 1)].title,
    assignedName: c.assignedTo ? who.get(c.assignedTo) ?? null : null,
    reporterName: c.reporterId ? who.get(c.reporterId) ?? null : null,
    subjectName: c.subjectUserId ? who.get(c.subjectUserId) ?? null : null,
    overdue: c.status !== "resolved" && c.status !== "closed" &&
      ((c.status === "open" && now > c.acknowledgeDueAt) || now > c.resolveDueAt),
    regulatorOverdue: !!c.regulatorDueAt && !c.regulatorNotifiedAt && now > c.regulatorDueAt,
  };
}

router.get("/organizations/:orgId/accountability/regime", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId); if (!org.success) { res.sendStatus(400); return; }
  const ctx = await memberContext(org.data, userId);
  if (!ctx.orgRole && !ctx.superadmin && !await isVerifiedGuardianAt(org.data, userId)) { res.sendStatus(404); return; }
  res.json(describeRegime(await regimeForOrganization(org.data)));
});

router.post("/organizations/:orgId/accountability/cases", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId);
  const body = createBody.safeParse(req.body);
  if (!org.success || !body.success) { res.status(400).json({ error: "Choose a kind and severity and describe the concern in at least 10 characters." }); return; }
  const ctx = await memberContext(org.data, userId);
  const verifiedGuardian = !ctx.orgRole && await isVerifiedGuardianAt(org.data, userId);
  if (!mayRaise(body.data.kind, { ...ctx, verifiedGuardian })) { res.status(403).json({ error: "You cannot raise this kind of case for this school." }); return; }
  if (ctx.superadmin) await auditSuperadmin(userId, "accountability_case_create", org.data);
  // The person a case is about must belong to this school (or be one of the
  // reporting guardian's verified children); never accept an arbitrary account id.
  if (body.data.subjectUserId) {
    const subject = await memberContext(org.data, body.data.subjectUserId);
    const allowed = !!subject.orgRole || (verifiedGuardian && await isVerifiedGuardianAt(org.data, userId, body.data.subjectUserId));
    if (!allowed) { res.status(400).json({ error: "That person is not part of this school." }); return; }
  }
  const row = await openCase({
    organizationId: org.data, kind: body.data.kind, severity: body.data.severity, summary: body.data.summary,
    reporterId: userId, subjectUserId: body.data.subjectUserId ?? null, awareAt: body.data.awareAt,
  });
  res.status(201).json(reporterProjection(row));
});

router.get("/organizations/:orgId/accountability/cases", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId); if (!org.success) { res.sendStatus(400); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const ctx = await memberContext(org.data, userId);
  if (!ctx.orgRole && !ctx.superadmin && !await isVerifiedGuardianAt(org.data, userId)) { res.sendStatus(404); return; }
  await sweepOverdue(org.data);
  const rows = await db.select().from(accountabilityCasesTable).where(eq(accountabilityCasesTable.organizationId, org.data))
    .orderBy(desc(accountabilityCasesTable.createdAt)).limit(300);
  const now = new Date();
  const visible = rows.map(c => ({ c, view: caseView(ctx, c) })).filter(x => x.view !== "none");
  const who = await names(visible.filter(x => x.view === "full").flatMap(x => [x.c.assignedTo, x.c.reporterId, x.c.subjectUserId]));
  res.json(visible.map(x => x.view === "full" ? fullProjection(x.c, who, now) : reporterProjection(x.c)));
});

router.get("/organizations/:orgId/accountability/cases/:caseId", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId), id = positive.safeParse(req.params.caseId);
  if (!org.success || !id.success) { res.sendStatus(400); return; }
  res.setHeader("Cache-Control", "private, no-store");
  await sweepOverdue(org.data);
  const [c] = await db.select().from(accountabilityCasesTable)
    .where(and(eq(accountabilityCasesTable.id, id.data), eq(accountabilityCasesTable.organizationId, org.data))).limit(1);
  const ctx = await memberContext(org.data, userId);
  const view = c ? caseView(ctx, c) : "none";
  if (!c || view === "none") { res.sendStatus(404); return; }
  if (view === "reporter") { res.json(reporterProjection(c)); return; }
  if (ctx.superadmin) await auditSuperadmin(userId, "accountability_case_read", org.data);
  const events = await db.select().from(accountabilityCaseEventsTable).where(eq(accountabilityCaseEventsTable.caseId, c.id))
    .orderBy(asc(accountabilityCaseEventsTable.id)).limit(500);
  const who = await names([c.assignedTo, c.reporterId, c.subjectUserId, ...events.map(e => e.actorId)]);
  res.json({
    ...fullProjection(c, who, new Date()), canHandle: mayHandle(ctx, c),
    events: events.map(e => ({ ...e, actorName: e.actorId ? who.get(e.actorId) ?? "Former member" : "CABO (automatic)" })),
  });
});

router.post("/organizations/:orgId/accountability/cases/:caseId/actions", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId), id = positive.safeParse(req.params.caseId), body = actionBody.safeParse(req.body);
  if (!org.success || !id.success || !body.success) { res.sendStatus(400); return; }
  const ctx = await memberContext(org.data, userId);
  const result = await db.transaction(async tx => {
    const [c] = await tx.select().from(accountabilityCasesTable)
      .where(and(eq(accountabilityCasesTable.id, id.data), eq(accountabilityCasesTable.organizationId, org.data))).for("update").limit(1);
    if (!c || caseView(ctx, c) !== "full") return { status: 404 as const };
    if (!mayHandle(ctx, c)) return { status: 403 as const, error: "Only the owner or someone at this escalation level can act on this case." };
    const now = new Date();
    const { action, note } = body.data;
    const needsNote = action === "resolve" || action === "close" || action === "reopen" || action === "note" || action === "regulator_notified";
    if (needsNote && note.length < 5) return { status: 400 as const, error: "Add a note of at least 5 characters explaining what was done." };
    const status = c.status as CaseStatus;
    const target: Record<string, CaseStatus | null> = { acknowledge: "acknowledged", start: "in_progress", resolve: "resolved", close: "closed", reopen: "in_progress", note: null, assign: null, regulator_notified: null };
    const next = target[action];
    if (next && !transitionAllowed(status, next)) return { status: 409 as const, error: `A ${status.replace("_", " ")} case cannot move to ${next.replace("_", " ")}.` };
    const patch: Partial<typeof accountabilityCasesTable.$inferInsert> = { updatedAt: now };
    if (next) patch.status = next;
    if (action === "acknowledge") { patch.acknowledgedAt = now; if (!c.assignedTo) patch.assignedTo = userId; }
    if (action === "start" && !c.acknowledgedAt) patch.acknowledgedAt = now;
    if (action === "resolve") patch.resolvedAt = now;
    if (action === "close") patch.closedAt = now;
    if (action === "reopen") { patch.resolvedAt = null; patch.closedAt = null; }
    if (action === "regulator_notified") {
      if (c.kind !== "data_incident") return { status: 400 as const, error: "Only data incidents are notified to the regulator." };
      if (c.regulatorNotifiedAt) return { status: 409 as const, error: "The regulator notification is already recorded." };
      patch.regulatorNotifiedAt = now;
    }
    if (action === "assign") {
      const assignee = body.data.assignee;
      if (!assignee) return { status: 400 as const, error: "Choose who should own the case." };
      if (assignee === c.subjectUserId) return { status: 400 as const, error: "The person the case is about cannot own it." };
      const target = await memberContext(org.data, assignee);
      if (!target.orgRole || effectiveRank(target) < LEVELS[Math.min(c.escalationLevel, LEVELS.length - 1)].minRank)
        return { status: 400 as const, error: "That person cannot own a case at this escalation level." };
      patch.assignedTo = assignee;
      // A new owner acknowledges again; the original deadlines still stand.
      if (status === "acknowledged") { patch.status = "open"; patch.acknowledgedAt = null; }
    }
    await tx.update(accountabilityCasesTable).set(patch).where(eq(accountabilityCasesTable.id, c.id));
    await recordEvent(tx, { caseId: c.id, organizationId: c.organizationId, actorId: userId, action: action === "assign" ? "assigned" : action, note: action === "assign" ? `${body.data.assignee}${note ? " · " + note : ""}` : note });
    return { status: 200 as const };
  });
  if (result.status !== 200) { res.status(result.status).json(result.status === 404 ? {} : { error: result.error }); return; }
  if (ctx.superadmin) await auditSuperadmin(userId, "accountability_case_action", org.data);
  res.json({ ok: true });
});

/** Candidates who can own a case at a level (for the assign menu). */
router.get("/organizations/:orgId/accountability/owners", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId), level = z.coerce.number().int().min(0).max(LEVELS.length - 1).safeParse(req.query.level ?? 0);
  if (!org.success || !level.success) { res.sendStatus(400); return; }
  const ctx = await memberContext(org.data, userId);
  if (!ctx.superadmin && effectiveRank(ctx) < LEVELS[0].minRank) { res.sendStatus(404); return; }
  const first = await chooseOwner(db, org.data, level.data, []);
  res.json({ level: level.data, title: LEVELS[level.data].title, suggested: first });
});

/** Response record per owner, for school leadership only. */
router.get("/organizations/:orgId/accountability/dashboard", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const org = positive.safeParse(req.params.orgId); if (!org.success) { res.sendStatus(400); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const ctx = await memberContext(org.data, userId);
  if (!ctx.superadmin && effectiveRank(ctx) < leadershipRanks.deputy_headmaster) { res.sendStatus(404); return; }
  await sweepOverdue(org.data);
  const now = new Date();
  const rows = await db.select().from(accountabilityCasesTable).where(eq(accountabilityCasesTable.organizationId, org.data)).limit(2000);
  const escalations = await db.select({ caseId: accountabilityCaseEventsTable.caseId, note: accountabilityCaseEventsTable.note })
    .from(accountabilityCaseEventsTable).where(and(eq(accountabilityCaseEventsTable.organizationId, org.data), eq(accountabilityCaseEventsTable.action, "escalated"))).limit(5000);
  // An escalation is counted against the owner who missed the deadline.
  const missedBy = new Map<string, number>();
  for (const e of escalations) {
    const m = /missed by (\S+)/.exec(e.note);
    if (m && m[1] !== "no") missedBy.set(m[1], (missedBy.get(m[1]) ?? 0) + 1);
  }
  const metrics = responseMetrics(rows.map(r => ({ ...r, escalations: 0 })), now)
    .map(m => ({ ...m, escalations: missedBy.get(m.userId) ?? 0 }));
  const who = await names([...metrics.map(m => m.userId), ...missedBy.keys()]);
  for (const [missedUser, count] of missedBy) if (!metrics.some(m => m.userId === missedUser))
    metrics.push({ userId: missedUser, assigned: 0, acknowledgedOnTime: 0, resolvedOnTime: 0, overdueNow: 0, escalations: count, medianHoursToAcknowledge: null });
  const open = rows.filter(r => r.status !== "resolved" && r.status !== "closed");
  res.json({
    regime: describeRegime(await regimeForOrganization(org.data)),
    totals: {
      open: open.length,
      overdue: open.filter(r => (r.status === "open" && now > r.acknowledgeDueAt) || now > r.resolveDueAt).length,
      withoutOwner: open.filter(r => !r.assignedTo).length,
      regulatorOverdue: rows.filter(r => r.regulatorDueAt && !r.regulatorNotifiedAt && now > r.regulatorDueAt).length,
      byKind: Object.fromEntries(CASE_KINDS.map(k => [k, open.filter(r => r.kind === k).length])),
    },
    people: metrics.map(m => ({ ...m, name: who.get(m.userId) ?? "Former member" }))
      .sort((a, b) => b.overdueNow - a.overdueNow || b.escalations - a.escalations),
    levels: LEVELS,
  });
});

export default router;
