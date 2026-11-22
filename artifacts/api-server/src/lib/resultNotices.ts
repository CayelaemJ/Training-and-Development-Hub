import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, usersTable, guardianRelationshipsTable, notificationPreferencesTable } from "@workspace/db";
import { enqueueApprovedNotice } from "./notificationOutbox";
import { logger } from "./logger";

/**
 * One notice per guardian, child, school and day, however many results are
 * published that day, so a teacher publishing a whole class does not send a
 * flood of emails. The id is a deterministic version-8 UUID; the outbox's
 * unique event id turns repeats into "duplicate".
 */
export function dailyEventId(guardianId: string, learnerId: string, organizationId: number, day: string): string {
  const h = createHash("sha256").update(["results_published", guardianId, learnerId, String(organizationId), day].join("\0")).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Queue result notices for the verified guardians of one learner who opted in
 * for this school. Every guardian is re-authorized inside enqueueApprovedNotice
 * (verified relationship, this school's latest decision, active enrolment,
 * published grade, confirmed consent) and again when the email is sent.
 * Failures never affect saving the result.
 */
export async function queueResultNotices(organizationId: number, gradeId: number, learnerId: string, now = new Date()): Promise<{ queued: number; skipped: number }> {
  let queued = 0, skipped = 0;
  if (process.env.CABO_NOTIFICATION_OUTBOX_ENABLED !== "true") return { queued, skipped };
  const guardians = await db.select({ guardianId: guardianRelationshipsTable.guardianId }).from(guardianRelationshipsTable)
    .where(and(eq(guardianRelationshipsTable.learnerId, learnerId), eq(guardianRelationshipsTable.status, "verified"))).limit(10);
  const day = now.toISOString().slice(0, 10);
  for (const { guardianId } of guardians) {
    try {
      const [pref] = await db.select({ optedIn: notificationPreferencesTable.optedIn }).from(notificationPreferencesTable).where(and(
        eq(notificationPreferencesTable.userId, guardianId), eq(notificationPreferencesTable.organizationId, organizationId),
        eq(notificationPreferencesTable.kind, "results_published"))).limit(1);
      if (!pref?.optedIn) { skipped++; continue; }
      const [account] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, guardianId)).limit(1);
      if (!account?.email) { skipped++; continue; }
      const outcome = await enqueueApprovedNotice({
        to: account.email, eventId: dailyEventId(guardianId, learnerId, organizationId, day), kind: "results_published",
        deliveryApproved: true, recipientUserId: guardianId, organizationId, source: { kind: "academic_grade", id: gradeId },
      });
      if (outcome === "queued") queued++; else skipped++;
    } catch (error) {
      skipped++;
      // No address, name or id in logs.
      logger.warn({ err: error instanceof Error ? error.name : "unknown" }, "result notice not queued");
    }
  }
  return { queued, skipped };
}
