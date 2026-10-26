import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db, guardianRelationshipsTable, guardianVerificationEventsTable,
  verifiedEnrollmentsTable, usersTable } from "@workspace/db";
import { parentMobileView, approvedNativeParentLearnerIds } from "../lib/parentMobilePolicy";
import { nativeAuthEnabled } from "../lib/nativeAuthPolicy";
import { canReadChildReport } from "../lib/guardianPolicy";
import { gather } from "./reportCards";
import { getSession, getSessionId } from "../lib/auth";

// Parent-first mobile read model. This is a deliberately small response:
// no unverified child's names, school identifiers, assessment marks or contact data.
// Device size has NO bearing on permission to view learner data.
const router: IRouter = Router();
router.get("/native/mobile/parent", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!nativeAuthEnabled(process.env)) { res.sendStatus(404); return; }
  const authorization = req.get("authorization");
  if (!authorization?.startsWith("Bearer ") || !req.isAuthenticated()) {
    res.status(401).json({ error: "Native parent sign-in required" }); return;
  }
  const sid = getSessionId(req);
  const session = sid ? await getSession(sid) : null;
  if (session?.access_token !== "cabo-native-session-v1") {
    res.status(403).json({ error: "Native sign-in required" }); return;
  }
  const relationships = await db
    .select({
      id: guardianRelationshipsTable.id,
      learnerId: guardianRelationshipsTable.learnerId,
      status: guardianRelationshipsTable.status,
    })
    .from(guardianRelationshipsTable)
    .where(eq(guardianRelationshipsTable.guardianId, req.user.id))
    .limit(100);
  const candidateIds = relationships
    .filter(r => r.status === "verified").map(r => r.learnerId);
  const eligible = candidateIds.length
    ? await db.select({
        learnerId: verifiedEnrollmentsTable.learnerId,
        organizationId: verifiedEnrollmentsTable.organizationId,
      })
        .from(verifiedEnrollmentsTable)
        .where(and(
          inArray(verifiedEnrollmentsTable.learnerId, candidateIds),
          eq(verifiedEnrollmentsTable.status, "active")
        )).limit(500)
    : [];
  const relationshipIds = relationships
    .filter(r => r.status === "verified").map(r => r.id);
  const organizationIds = [...new Set(eligible.map(r => r.organizationId))];
  // All matching review events are sorted newest first. Truncated/missing
  // evidence fails closed; a revoked latest review never grants a learner name.
  const reviews = relationshipIds.length && organizationIds.length
    ? await db.select({
        relationshipId: guardianVerificationEventsTable.relationshipId,
        organizationId: guardianVerificationEventsTable.organizationId,
        decision: guardianVerificationEventsTable.decision,
      }).from(guardianVerificationEventsTable)
        .where(and(
          inArray(guardianVerificationEventsTable.relationshipId, relationshipIds),
          inArray(guardianVerificationEventsTable.organizationId, organizationIds),
        ))
        .orderBy(desc(guardianVerificationEventsTable.createdAt),
                 desc(guardianVerificationEventsTable.id))
        .limit(3000)
    : [];
  const latestDecisions = new Map<string, string>();
  for (const review of reviews) {
    const key = review.relationshipId + ":" + review.organizationId;
    if (!latestDecisions.has(key)) latestDecisions.set(key, review.decision);
  }
  const approvedIds = approvedNativeParentLearnerIds(relationships, eligible, latestDecisions);
  const nameIds = [...approvedIds];
  const names = nameIds.length
    ? await db.select({ id: usersTable.id, firstName: usersTable.firstName })
        .from(usersTable).where(inArray(usersTable.id, nameIds))
    : [];
  const byId = new Map(names.map(u => [u.id, u.firstName]));
  res.json({
    relationships: relationships.map(r => parentMobileView(
      r, approvedIds, byId
    )),
    guidance: "Accepting an invitation is not proof of guardianship. School verification is required before viewing a child's progress.",
  });
});
// Guardian reports use the SAME server-side lawful access checks as web
// report cards. A pending/accepted invitation never reveals grades or identity.
router.get("/native/mobile/parent/reports", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!nativeAuthEnabled(process.env)) { res.sendStatus(404); return; }
  if (!req.get("authorization")?.startsWith("Bearer ") || !req.isAuthenticated()) {
    res.sendStatus(401); return;
  }
  const sid = getSessionId(req);
  const session = sid ? await getSession(sid) : null;
  if (session?.access_token !== "cabo-native-session-v1") {
    res.sendStatus(403); return;
  }
  const yearParam = z.coerce.number().int().min(2000).max(2200)
    .safeParse(req.query.year ?? new Date().getUTCFullYear());
  if (!yearParam.success) { res.sendStatus(400); return; }
  const year = yearParam.data;
  const relationships = await db.select({
    id: guardianRelationshipsTable.id,
    learnerId: guardianRelationshipsTable.learnerId,
    status: guardianRelationshipsTable.status
  }).from(guardianRelationshipsTable)
    .where(and(eq(guardianRelationshipsTable.guardianId, req.user.id),
               eq(guardianRelationshipsTable.status, "verified"))).limit(30);

  const reports: Array<{
    learnerId: string; learnerName: string; organizationId: number;
    year: number; grade: string; subjects: Array<{name:string;percentage:number;assessmentCount:number}>;
    average: number|null;
    attendance: {recordedDays:number;presentDays:number;rate:number|null};
    official: false; status: "draft_preview";
  }> = [];
  for (const relation of relationships) {
    const enrolments = await db.select({
      organizationId: verifiedEnrollmentsTable.organizationId
    }).from(verifiedEnrollmentsTable).where(and(
      eq(verifiedEnrollmentsTable.learnerId, relation.learnerId),
      eq(verifiedEnrollmentsTable.status, "active"),
      eq(verifiedEnrollmentsTable.academicYear, year)
    )).limit(8);
    for (const { organizationId } of enrolments) {
      const [event] = await db.select({decision: guardianVerificationEventsTable.decision})
        .from(guardianVerificationEventsTable).where(and(
          eq(guardianVerificationEventsTable.relationshipId, relation.id),
          eq(guardianVerificationEventsTable.organizationId, organizationId)
        )).orderBy(desc(guardianVerificationEventsTable.createdAt),
                   desc(guardianVerificationEventsTable.id)).limit(1);
      if (!canReadChildReport("verified", event?.decision === "verified", true))
        continue;
      const report = await gather(organizationId, relation.learnerId, year);
      if (!report) continue;
      const [user] = await db.select({
        firstName: usersTable.firstName, lastName: usersTable.lastName
      }).from(usersTable).where(eq(usersTable.id, relation.learnerId)).limit(1);
      reports.push({
        learnerId: relation.learnerId,
        learnerName: [user?.firstName,user?.lastName].filter(Boolean).join(" ") || "Verified learner",
        organizationId, year, grade: report.grade, subjects: report.subjects,
        average: report.average, attendance: report.attendance,
        official: false, status: "draft_preview",
      });
      if (reports.length >= 20) break;
    }
    if (reports.length >= 20) break;
  }
  res.json({
    year, reports,
    guidance: "Draft progress only. Verified school guardianship and active enrolment are required. These are not officially issued report cards."
  });
});
export default router;
