// Learner-approved passport sharing with universities, colleges and employers.
// Every route is signed-in only and enforces ownership (learner), verified
// guardianship (parent) or recipient-institution membership (staff) on the
// server. Nothing here trusts a client-supplied user, role or institution.
import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, count, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, usersTable, organizationsTable, organizationMembersTable, academicSettingsTable,
  guardianRelationshipsTable, academicGradesTable, academicAssessmentsTable, academicCoursesTable,
  learnerSupportTicketsTable, learnerSupportEventsTable, passportCompetenciesTable,
  passportAchievementReviewsTable, learnerJourneysTable, learnerMilestonesTable,
  passportSharesTable, passportShareViewsTable,
} from "@workspace/db";
import {
  MAX_OPEN_SHARES, SCOPE_LABEL, SHARE_SCOPES, effectiveStatus, initialStatus, isRecipientInstitution,
  parseShareRequest, recipientMayView, scopedSnapshot, sharingEnabled, type ShareScope,
} from "../lib/passportSharePolicy";

const router: IRouter = Router();
const DAY = 86_400_000;
const id = z.coerce.number().int().positive();

function signedIn(req: Request, res: Response): string | null {
  res.setHeader("Cache-Control", "private, no-store");
  if (!sharingEnabled()) { res.status(404).json({ error: "Passport sharing is not switched on for this server." }); return null; }
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Sign in required" }); return null; }
  return req.user!.id;
}

async function institutionType(organizationId: number): Promise<string | null> {
  const [row] = await db.select({ t: academicSettingsTable.institutionType }).from(academicSettingsTable)
    .where(eq(academicSettingsTable.organizationId, organizationId)).limit(1);
  return row?.t ?? null;
}
async function verifiedGuardians(learnerId: string): Promise<string[]> {
  return (await db.select({ g: guardianRelationshipsTable.guardianId }).from(guardianRelationshipsTable)
    .where(and(eq(guardianRelationshipsTable.learnerId, learnerId), eq(guardianRelationshipsTable.status, "verified")))
    .limit(10)).map(r => r.g);
}
async function memberRole(organizationId: number, userId: string): Promise<string | null> {
  const [m] = await db.select({ role: organizationMembersTable.role }).from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.organizationId, organizationId), eq(organizationMembersTable.userId, userId))).limit(1);
  return m?.role ?? null;
}

/** Universities, colleges and employers a learner can share with (never schools). */
router.get("/passport-shares/recipients", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const orgs = await db.select({ id: organizationsTable.id, name: organizationsTable.name, type: academicSettingsTable.institutionType })
    .from(organizationsTable).leftJoin(academicSettingsTable, eq(academicSettingsTable.organizationId, organizationsTable.id))
    .orderBy(asc(organizationsTable.name)).limit(500);
  res.json(orgs.filter(o => isRecipientInstitution(o.type)).map(o => ({
    id: o.id, name: o.name, kind: o.type && /univ|college|tvet/i.test(o.type) ? "higher_education" : "organisation",
  })));
});

/** The signed-in learner's shares, with who viewed and when. */
router.get("/passport-shares/me", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const rows = await db.select({ share: passportSharesTable, recipient: organizationsTable.name })
    .from(passportSharesTable).innerJoin(organizationsTable, eq(organizationsTable.id, passportSharesTable.organizationId))
    .where(eq(passportSharesTable.learnerId, userId)).orderBy(desc(passportSharesTable.createdAt)).limit(100);
  const views = rows.length ? await db.select({ shareId: passportShareViewsTable.shareId, n: count(), last: sql<string>`max(${passportShareViewsTable.viewedAt})` })
    .from(passportShareViewsTable).where(inArray(passportShareViewsTable.shareId, rows.map(r => r.share.id)))
    .groupBy(passportShareViewsTable.shareId) : [];
  const byShare = new Map(views.map(v => [v.shareId, v]));
  res.json({
    scopes: SHARE_SCOPES.map(s => ({ id: s, label: SCOPE_LABEL[s] })),
    shares: rows.map(({ share, recipient }) => ({
      id: share.id, recipient, purpose: share.purpose, scope: share.scope,
      status: effectiveStatus(share), expiresAt: share.expiresAt, createdAt: share.createdAt,
      views: Number(byShare.get(share.id)?.n ?? 0), lastViewedAt: byShare.get(share.id)?.last ?? null,
    })),
  });
});

router.post("/passport-shares", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const body = parseShareRequest(req.body);
  if (!body) { res.status(400).json({ error: "Choose an institution, a purpose, at least one section and 7 to 365 days." }); return; }
  const [org] = await db.select({ id: organizationsTable.id }).from(organizationsTable).where(eq(organizationsTable.id, body.organizationId)).limit(1);
  if (!org || !isRecipientInstitution(await institutionType(org.id))) { res.status(404).json({ error: "That institution cannot receive passports." }); return; }
  const [recent] = await db.select({ n: count() }).from(passportSharesTable)
    .where(and(eq(passportSharesTable.learnerId, userId), gt(passportSharesTable.createdAt, new Date(Date.now() - 3600_000))));
  if (Number(recent?.n ?? 0) >= 10) { res.setHeader("Retry-After", "3600"); res.status(429).json({ error: "Too many shares in the last hour. Try again later." }); return; }
  const [open] = await db.select({ n: count() }).from(passportSharesTable)
    .where(and(eq(passportSharesTable.learnerId, userId), inArray(passportSharesTable.status, ["active", "pending_guardian"]), isNull(passportSharesTable.revokedAt), gt(passportSharesTable.expiresAt, new Date())));
  if (Number(open?.n ?? 0) >= MAX_OPEN_SHARES) { res.status(409).json({ error: `You can have up to ${MAX_OPEN_SHARES} open shares. Revoke one first.` }); return; }
  const status = initialStatus((await verifiedGuardians(userId)).length > 0);
  const [share] = await db.insert(passportSharesTable).values({
    learnerId: userId, organizationId: org.id, purpose: body.purpose, scope: body.scope, status,
    expiresAt: new Date(Date.now() + body.days * DAY),
  }).returning({ id: passportSharesTable.id });
  res.status(201).json({ id: share.id, status, notice: status === "pending_guardian" ? "Your parent or guardian needs to approve this before the institution can see anything." : null });
});

router.post("/passport-shares/:id/revoke", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const shareId = id.safeParse(req.params.id);
  if (!shareId.success) { res.sendStatus(400); return; }
  const changed = await db.update(passportSharesTable).set({ status: "revoked", revokedAt: new Date() })
    .where(and(eq(passportSharesTable.id, shareId.data), eq(passportSharesTable.learnerId, userId), isNull(passportSharesTable.revokedAt)))
    .returning({ id: passportSharesTable.id });
  if (!changed.length) { res.sendStatus(404); return; }
  res.json({ ok: true });
});

/** Shares waiting for this guardian's approval (verified children only). */
router.get("/passport-shares/guardian/pending", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const children = (await db.select({ l: guardianRelationshipsTable.learnerId }).from(guardianRelationshipsTable)
    .where(and(eq(guardianRelationshipsTable.guardianId, userId), eq(guardianRelationshipsTable.status, "verified"))).limit(30)).map(r => r.l);
  if (!children.length) { res.json([]); return; }
  const rows = await db.select({ share: passportSharesTable, recipient: organizationsTable.name, childName: usersTable.firstName })
    .from(passportSharesTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, passportSharesTable.organizationId))
    .innerJoin(usersTable, eq(usersTable.id, passportSharesTable.learnerId))
    .where(and(inArray(passportSharesTable.learnerId, children), eq(passportSharesTable.status, "pending_guardian"), isNull(passportSharesTable.revokedAt)))
    .orderBy(desc(passportSharesTable.createdAt)).limit(50);
  res.json(rows.map(({ share, recipient, childName }) => ({
    id: share.id, childName: childName ?? "Your child", recipient, purpose: share.purpose,
    scope: share.scope.map(s => SCOPE_LABEL[s as ShareScope] ?? s), expiresAt: share.expiresAt,
  })));
});

router.post("/passport-shares/:id/guardian-decision", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const shareId = id.safeParse(req.params.id);
  const decision = z.enum(["approve", "decline"]).safeParse(req.body?.decision);
  if (!shareId.success || !decision.success) { res.sendStatus(400); return; }
  const [share] = await db.select().from(passportSharesTable).where(eq(passportSharesTable.id, shareId.data)).limit(1);
  // Same 404 for "no such share" and "not your child", so nothing is disclosed.
  if (!share || share.status !== "pending_guardian" || share.revokedAt || !(await verifiedGuardians(share.learnerId)).includes(userId)) { res.sendStatus(404); return; }
  await db.update(passportSharesTable).set({ status: decision.data === "approve" ? "active" : "declined", guardianId: userId, guardianDecidedAt: new Date() })
    .where(and(eq(passportSharesTable.id, share.id), eq(passportSharesTable.status, "pending_guardian")));
  res.json({ ok: true });
});

/** Recipient staff: active shares addressed to their institution. */
router.get("/organizations/:orgId/shared-passports", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const orgId = id.safeParse(req.params.orgId);
  if (!orgId.success) { res.sendStatus(400); return; }
  const role = await memberRole(orgId.data, userId);
  if (!role || !["owner", "admin"].includes(role)) { res.sendStatus(403); return; }
  const rows = await db.select({ share: passportSharesTable, first: usersTable.firstName, last: usersTable.lastName })
    .from(passportSharesTable).innerJoin(usersTable, eq(usersTable.id, passportSharesTable.learnerId))
    .where(and(eq(passportSharesTable.organizationId, orgId.data), eq(passportSharesTable.status, "active"), isNull(passportSharesTable.revokedAt), gt(passportSharesTable.expiresAt, new Date())))
    .orderBy(desc(passportSharesTable.createdAt)).limit(200);
  res.json(rows.map(({ share, first, last }) => ({
    id: share.id, learnerName: [first, last].filter(Boolean).join(" ") || "Learner", purpose: share.purpose,
    scope: share.scope.map(s => ({ id: s, label: SCOPE_LABEL[s as ShareScope] ?? s })), expiresAt: share.expiresAt, sharedAt: share.createdAt,
  })));
});

/** Recipient staff: open one shared passport. Only the chosen sections; every view is logged. */
router.get("/organizations/:orgId/shared-passports/:shareId", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const orgId = id.safeParse(req.params.orgId), shareId = id.safeParse(req.params.shareId);
  if (!orgId.success || !shareId.success) { res.sendStatus(400); return; }
  const [share] = await db.select().from(passportSharesTable)
    .where(and(eq(passportSharesTable.id, shareId.data), eq(passportSharesTable.organizationId, orgId.data))).limit(1);
  const role = await memberRole(orgId.data, userId);
  if (!share || !recipientMayView(share, role)) { res.sendStatus(404); return; }
  await db.insert(passportShareViewsTable).values({ shareId: share.id, viewerId: userId });
  const learner = share.learnerId, scope = share.scope;
  const [person] = await db.select({ first: usersTable.firstName, last: usersTable.lastName }).from(usersTable).where(eq(usersTable.id, learner)).limit(1);
  const all: Partial<Record<ShareScope, unknown>> = {};
  if (scope.includes("results")) {
    const rows = await db.select({
      subject: academicCoursesTable.name, level: academicCoursesTable.level, institution: organizationsTable.name,
      pct: sql<number>`round(avg(${academicGradesTable.marks} / nullif(${academicAssessmentsTable.maxMarks}, 0) * 100)::numeric, 1)`,
      results: count(),
    }).from(academicGradesTable)
      .innerJoin(academicAssessmentsTable, eq(academicAssessmentsTable.id, academicGradesTable.assessmentId))
      .innerJoin(academicCoursesTable, eq(academicCoursesTable.id, academicAssessmentsTable.courseId))
      .innerJoin(organizationsTable, eq(organizationsTable.id, academicCoursesTable.organizationId))
      .where(and(eq(academicGradesTable.learnerId, learner), eq(academicGradesTable.status, "published")))
      .groupBy(academicCoursesTable.name, academicCoursesTable.level, organizationsTable.name).limit(60);
    all.results = rows.map(r => ({ ...r, pct: r.pct == null ? null : Number(r.pct), results: Number(r.results) }));
  }
  if (scope.includes("learning_dna")) {
    const rows = await db.select({ concept: learnerSupportTicketsTable.concept, evidence: learnerSupportEventsTable.metadata, at: learnerSupportEventsTable.createdAt })
      .from(learnerSupportEventsTable).innerJoin(learnerSupportTicketsTable, eq(learnerSupportTicketsTable.id, learnerSupportEventsTable.ticketId))
      .where(and(eq(learnerSupportTicketsTable.learnerId, learner), eq(learnerSupportEventsTable.kind, "learning_dna")))
      .orderBy(desc(learnerSupportEventsTable.createdAt)).limit(60);
    const latest = new Map<string, { concept: string; state: string; reviewedAt: Date }>();
    for (const r of rows) if (!latest.has(r.concept)) latest.set(r.concept, { concept: r.concept, state: String((r.evidence as { state?: string })?.state ?? "needs_review"), reviewedAt: r.at });
    all.learning_dna = [...latest.values()];
  }
  if (scope.includes("skills")) {
    all.skills = await db.select({ skill: passportCompetenciesTable.skill, category: passportCompetenciesTable.category, masteryLevel: passportCompetenciesTable.masteryLevel, demonstration: passportCompetenciesTable.demonstration, description: passportCompetenciesTable.description })
      .from(passportCompetenciesTable).where(eq(passportCompetenciesTable.userId, learner)).orderBy(desc(passportCompetenciesTable.createdAt)).limit(50);
  }
  if (scope.includes("verified_achievements")) {
    // Reviewer identity and notes stay with the reviewing institution.
    all.verified_achievements = await db.select({ skill: passportCompetenciesTable.skill, verifiedBy: organizationsTable.name, verifiedAt: passportAchievementReviewsTable.reviewedAt })
      .from(passportAchievementReviewsTable)
      .innerJoin(passportCompetenciesTable, eq(passportCompetenciesTable.id, passportAchievementReviewsTable.competencyId))
      .innerJoin(organizationsTable, eq(organizationsTable.id, passportAchievementReviewsTable.organizationId))
      .where(and(eq(passportAchievementReviewsTable.userId, learner), eq(passportAchievementReviewsTable.status, "verified"))).limit(50);
  }
  if (scope.includes("journey")) {
    all.journey = {
      stages: await db.select({ institution: learnerJourneysTable.institutionName, stage: learnerJourneysTable.stage, year: learnerJourneysTable.academicYear, source: learnerJourneysTable.source })
        .from(learnerJourneysTable).where(eq(learnerJourneysTable.userId, learner)).orderBy(asc(learnerJourneysTable.academicYear)).limit(40),
      milestones: await db.select({ title: learnerMilestonesTable.title, kind: learnerMilestonesTable.kind, year: learnerMilestonesTable.year, source: learnerMilestonesTable.source })
        .from(learnerMilestonesTable).where(eq(learnerMilestonesTable.userId, learner)).orderBy(desc(learnerMilestonesTable.year)).limit(40),
    };
  }
  res.json({
    learnerName: [person?.first, person?.last].filter(Boolean).join(" ") || "Learner",
    purpose: share.purpose, sharedAt: share.createdAt, expiresAt: share.expiresAt,
    scope: scope.map(s => ({ id: s, label: SCOPE_LABEL[s as ShareScope] ?? s })),
    sections: scopedSnapshot(all, scope),
    provenance: "Shared by the learner for this purpose only. Results are school-published marks, skills are self-reported, and verified achievements were reviewed by the named institution. Not a certified qualification.",
  });
});

export default router;
