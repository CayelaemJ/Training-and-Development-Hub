// Child progress analytics for verified guardians.
//
// Access uses the SAME three checks as guardian report cards
// (routes/reportCards.ts /guardian/reports/:learnerId):
//   1. the guardian's relationship with the learner is "verified";
//   2. the latest verification decision recorded BY THIS SCHOOL is "verified";
//   3. the learner has an active verified enrolment at this school.
// Only published marks are used. Classmates' marks are used only in aggregate,
// subject to the privacy rules in lib/guardianProgressPolicy.ts.
import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, usersTable, organizationsTable, guardianRelationshipsTable, guardianVerificationEventsTable, verifiedEnrollmentsTable,
  academicCoursesTable, academicAssessmentsTable, academicGradesTable, academicPeriodsTable, schoolAttendanceTable,
} from "@workspace/db";
import { canReadChildReport } from "../lib/guardianPolicy";
import { childProgress } from "../lib/guardianProgressPolicy";

const router: IRouter = Router();
const positive = z.coerce.number().int().positive();
const yearSchema = z.coerce.number().int().min(2000).max(2200);
const MAX_CHILD_LINKS = 30;

function signedIn(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) { res.sendStatus(401); return null; }
  return req.user!.id;
}

/** Latest decision recorded by this school for this relationship (ties broken by id). */
async function latestDecision(relationshipId: number, organizationId: number) {
  const [event] = await db.select({ decision: guardianVerificationEventsTable.decision }).from(guardianVerificationEventsTable)
    .where(and(eq(guardianVerificationEventsTable.relationshipId, relationshipId), eq(guardianVerificationEventsTable.organizationId, organizationId)))
    .orderBy(desc(guardianVerificationEventsTable.createdAt), desc(guardianVerificationEventsTable.id)).limit(1);
  return event?.decision ?? null;
}

/** Returns the active enrolment when, and only when, all three access checks pass. */
async function verifiedChildAccess(guardianId: string, learnerId: string, organizationId: number) {
  const [relationship] = await db.select({ id: guardianRelationshipsTable.id }).from(guardianRelationshipsTable)
    .where(and(eq(guardianRelationshipsTable.guardianId, guardianId), eq(guardianRelationshipsTable.learnerId, learnerId), eq(guardianRelationshipsTable.status, "verified"))).limit(1);
  if (!relationship) return null;
  const decision = await latestDecision(relationship.id, organizationId);
  const [enrolment] = await db.select({ stage: verifiedEnrollmentsTable.stage, academicYear: verifiedEnrollmentsTable.academicYear }).from(verifiedEnrollmentsTable)
    .where(and(eq(verifiedEnrollmentsTable.organizationId, organizationId), eq(verifiedEnrollmentsTable.learnerId, learnerId), eq(verifiedEnrollmentsTable.status, "active")))
    .orderBy(desc(verifiedEnrollmentsTable.academicYear)).limit(1);
  return canReadChildReport("verified", decision === "verified", !!enrolment) ? enrolment! : null;
}

// Children this guardian may currently see. Replaces typing a child account id.
router.get("/guardian/children", async (req, res) => {
  const guardianId = signedIn(req, res); if (!guardianId) return;
  res.setHeader("Cache-Control", "private, no-store");
  const relationships = await db.select({ id: guardianRelationshipsTable.id, learnerId: guardianRelationshipsTable.learnerId }).from(guardianRelationshipsTable)
    .where(and(eq(guardianRelationshipsTable.guardianId, guardianId), eq(guardianRelationshipsTable.status, "verified"))).limit(MAX_CHILD_LINKS);
  const children: { learnerId: string; learnerName: string; organizationId: number; organization: string; grade: string; academicYear: number }[] = [];
  for (const relationship of relationships) {
    const enrolments = await db.select({ organizationId: verifiedEnrollmentsTable.organizationId, stage: verifiedEnrollmentsTable.stage, academicYear: verifiedEnrollmentsTable.academicYear, organization: organizationsTable.name })
      .from(verifiedEnrollmentsTable).innerJoin(organizationsTable, eq(organizationsTable.id, verifiedEnrollmentsTable.organizationId))
      .where(and(eq(verifiedEnrollmentsTable.learnerId, relationship.learnerId), eq(verifiedEnrollmentsTable.status, "active")))
      .orderBy(desc(verifiedEnrollmentsTable.academicYear)).limit(8);
    const seen = new Set<number>();
    for (const e of enrolments) {
      if (seen.has(e.organizationId)) continue;
      seen.add(e.organizationId);
      if (await latestDecision(relationship.id, e.organizationId) !== "verified") continue;
      const [person] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable).where(eq(usersTable.id, relationship.learnerId)).limit(1);
      children.push({
        learnerId: relationship.learnerId,
        learnerName: [person?.firstName, person?.lastName].filter(Boolean).join(" ") || "Your child",
        organizationId: e.organizationId, organization: e.organization, grade: e.stage, academicYear: e.academicYear,
      });
    }
  }
  res.json(children);
});

router.get("/guardian/progress/:learnerId", async (req, res) => {
  const guardianId = signedIn(req, res); if (!guardianId) return;
  const org = positive.safeParse(req.query.organizationId);
  const year = yearSchema.safeParse(req.query.year ?? new Date().getUTCFullYear());
  const learnerId = z.string().min(1).max(128).safeParse(req.params.learnerId);
  if (!org.success || !year.success || !learnerId.success) { res.sendStatus(400); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const enrolment = await verifiedChildAccess(guardianId, learnerId.data, org.data);
  // One answer for "no such child", "not your child" and "not verified here".
  if (!enrolment) { res.sendStatus(403); return; }

  const periods = await db.select({ id: academicPeriodsTable.id, name: academicPeriodsTable.name }).from(academicPeriodsTable)
    .where(and(eq(academicPeriodsTable.organizationId, org.data), eq(academicPeriodsTable.year, year.data)))
    .orderBy(sql`${academicPeriodsTable.beginsAt} asc nulls last`, asc(academicPeriodsTable.id));
  const periodIds = periods.map(p => p.id);

  // The child's published marks, limited to courses at the child's current grade (same rule as report cards).
  const childMarks = periodIds.length ? await db.select({
    courseId: academicCoursesTable.id, subject: academicCoursesTable.name, periodId: academicAssessmentsTable.periodId,
    marks: academicGradesTable.marks, maxMarks: academicAssessmentsTable.maxMarks, weight: academicAssessmentsTable.weight,
    assessment: academicAssessmentsTable.title, publishedAt: academicGradesTable.updatedAt,
  }).from(academicGradesTable)
    .innerJoin(academicAssessmentsTable, eq(academicAssessmentsTable.id, academicGradesTable.assessmentId))
    .innerJoin(academicCoursesTable, eq(academicCoursesTable.id, academicAssessmentsTable.courseId))
    .where(and(eq(academicCoursesTable.organizationId, org.data), eq(academicGradesTable.learnerId, learnerId.data), eq(academicGradesTable.status, "published"),
      inArray(academicAssessmentsTable.periodId, periodIds), eq(academicCoursesTable.level, enrolment.stage))) : [];

  // Classmates' published marks for the same courses and terms. Aggregated by the policy; never returned.
  const courseIds = [...new Set(childMarks.map(m => m.courseId))];
  const cohortMarks = courseIds.length ? await db.select({
    learnerId: academicGradesTable.learnerId, courseId: academicAssessmentsTable.courseId, periodId: academicAssessmentsTable.periodId,
    marks: academicGradesTable.marks, maxMarks: academicAssessmentsTable.maxMarks, weight: academicAssessmentsTable.weight,
  }).from(academicGradesTable)
    .innerJoin(academicAssessmentsTable, eq(academicAssessmentsTable.id, academicGradesTable.assessmentId))
    .where(and(eq(academicAssessmentsTable.organizationId, org.data), eq(academicGradesTable.status, "published"),
      inArray(academicAssessmentsTable.courseId, courseIds), inArray(academicAssessmentsTable.periodId, periodIds))) : [];

  const attendance = await db.select({ day: schoolAttendanceTable.day, status: schoolAttendanceTable.status }).from(schoolAttendanceTable)
    .where(and(eq(schoolAttendanceTable.organizationId, org.data), eq(schoolAttendanceTable.learnerId, learnerId.data),
      gte(schoolAttendanceTable.day, `${year.data}-01-01`), lt(schoolAttendanceTable.day, `${year.data + 1}-01-01`)));

  const recentResults = [...childMarks]
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 5)
    .map(m => ({ subject: m.subject, assessment: m.assessment, percentage: m.maxMarks > 0 ? (m.marks / m.maxMarks) * 100 : 0, publishedAt: m.publishedAt }));

  const [person] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable).where(eq(usersTable.id, learnerId.data)).limit(1);
  const [school] = await db.select({ name: organizationsTable.name }).from(organizationsTable).where(eq(organizationsTable.id, org.data)).limit(1);
  res.json({
    learnerId: learnerId.data,
    learnerName: [person?.firstName, person?.lastName].filter(Boolean).join(" ") || "Your child",
    organizationId: org.data, organization: school?.name ?? "", grade: enrolment.stage, year: year.data,
    visibility: "verified_guardian", official: false,
    ...childProgress({ periods, childMarks, cohortMarks, childId: learnerId.data, attendance, recentResults }),
  });
});

export default router;
