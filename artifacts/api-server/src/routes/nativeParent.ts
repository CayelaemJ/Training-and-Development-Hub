import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  guardianRelationshipsTable,
  guardianVerificationEventsTable,
  verifiedEnrollmentsTable,
  usersTable,
} from "@workspace/db";
import { approvedNativeParentLearnerIds, parentMobileView } from "../lib/parentMobilePolicy";
import { nativeAuthEnabled } from "../lib/nativeAuthPolicy";
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
        ))
        .limit(500)
    : [];
  const relationshipIds = relationships
    .filter(r => r.status === "verified")
    .map(r => r.id);
  const organizationIds = [...new Set(eligible.map(r => r.organizationId))];
  const reviews = relationshipIds.length && organizationIds.length
    ? await db.select({
        relationshipId: guardianVerificationEventsTable.relationshipId,
        organizationId: guardianVerificationEventsTable.organizationId,
        decision: guardianVerificationEventsTable.decision,
      })
        .from(guardianVerificationEventsTable)
        .where(and(
          inArray(guardianVerificationEventsTable.relationshipId, relationshipIds),
          inArray(guardianVerificationEventsTable.organizationId, organizationIds),
        ))
        .orderBy(
          desc(guardianVerificationEventsTable.createdAt),
          desc(guardianVerificationEventsTable.id),
        )
        .limit(3000)
    : [];
  const latestDecisions = new Map<string, string>();
  for (const review of reviews) {
    const key = `${review.relationshipId}:${review.organizationId}`;
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
export default router;
