import { and, desc, eq } from "drizzle-orm";
import {
  db, usersTable, notificationPreferencesTable, notificationEventSourcesTable,
  guardianRelationshipsTable, guardianVerificationEventsTable,
  verifiedEnrollmentsTable, learnerSupportTicketsTable,
  courseEnrollmentsTable, courseStaffAssignmentsTable, organizationMembersTable,
} from "@workspace/db";
import { isNotificationEligible, type NotificationKind, type NoticeSource } from "./notificationEligibility";

export type AuthorizationRequest={
  eventId:string;
  recipientUserId:string;
  organizationId:number|null;
  kind:NotificationKind;
  to:string;
};

function addressesMatch(current:string|null,to:string):boolean {
  return !!current && current.trim().toLowerCase()===to.trim().toLowerCase();
}

/** Live source/recipient/consent verification; never trusts the original enqueue. */
export async function currentNoticeAuthorization(input:AuthorizationRequest):Promise<boolean> {
  const org=input.organizationId;
  if(!Number.isSafeInteger(org)||!org||org<1) return false;
  const [source]=await db.select({
    sourceKind:notificationEventSourcesTable.sourceKind,
    sourceId:notificationEventSourcesTable.sourceId,
  }).from(notificationEventSourcesTable)
    .where(eq(notificationEventSourcesTable.eventId,input.eventId)).limit(1);
  if(!source || !["support_ticket","guardian_relationship"].includes(source.sourceKind)) return false;
  const typed:NoticeSource={kind:source.sourceKind as NoticeSource["kind"],id:source.sourceId};
  const [account,preference]=await Promise.all([
    db.select({email:usersTable.email}).from(usersTable)
      .where(eq(usersTable.id,input.recipientUserId)).limit(1),
    db.select({
      optedIn:notificationPreferencesTable.optedIn,
      confirmedAt:notificationPreferencesTable.confirmedAt,
      revokedAt:notificationPreferencesTable.revokedAt,
    }).from(notificationPreferencesTable).where(and(
      eq(notificationPreferencesTable.userId,input.recipientUserId),
      eq(notificationPreferencesTable.organizationId,org),
      eq(notificationPreferencesTable.kind,input.kind),
    )).limit(1),
  ]);
  const base={
    kind:input.kind,source:typed,
    emailMatches:addressesMatch(account[0]?.email??null,input.to),
    preference:preference[0]??null,
  };
  // Nothing is allowed solely because an email exists in the user record.
  if(!base.emailMatches || !base.preference?.optedIn ||
     !base.preference.confirmedAt || base.preference.revokedAt) return false;
  if(typed.kind==="guardian_relationship" && input.kind==="guardian_review_requested") {
    const [relationship]=await db.select({
      id:guardianRelationshipsTable.id,
      learnerId:guardianRelationshipsTable.learnerId,
      status:guardianRelationshipsTable.status,
    }).from(guardianRelationshipsTable).where(and(
      eq(guardianRelationshipsTable.id,typed.id),
      eq(guardianRelationshipsTable.guardianId,input.recipientUserId),
    )).limit(1);
    if(!relationship || relationship.status!=="verified")return false;
    const [enrollment,latest]=await Promise.all([
      db.select({id:verifiedEnrollmentsTable.id}).from(verifiedEnrollmentsTable).where(and(
        eq(verifiedEnrollmentsTable.organizationId,org),
        eq(verifiedEnrollmentsTable.learnerId,relationship.learnerId),
        eq(verifiedEnrollmentsTable.status,"active"),
      )).limit(1),
      db.select({decision:guardianVerificationEventsTable.decision})
        .from(guardianVerificationEventsTable).where(and(
          eq(guardianVerificationEventsTable.organizationId,org),
          eq(guardianVerificationEventsTable.relationshipId,relationship.id),
        )).orderBy(desc(guardianVerificationEventsTable.createdAt),desc(guardianVerificationEventsTable.id)).limit(1),
    ]);
    return isNotificationEligible({
      ...base,activeEnrollment:!!enrollment.length,
      verifiedGuardianRelationship:true,latestGuardianDecision:latest[0]?.decision??null,
    });
  }
  if(typed.kind==="support_ticket" && input.kind==="learner_support_updated") {
    const [ticket]=await db.select({
      id:learnerSupportTicketsTable.id,
      learnerId:learnerSupportTicketsTable.learnerId,
      courseId:learnerSupportTicketsTable.courseId,
    }).from(learnerSupportTicketsTable).where(and(
      eq(learnerSupportTicketsTable.id,typed.id),
      eq(learnerSupportTicketsTable.organizationId,org),
    )).limit(1);
    if(!ticket)return false;
    const [enrolled]=await db.select({id:verifiedEnrollmentsTable.id})
      .from(verifiedEnrollmentsTable).where(and(
        eq(verifiedEnrollmentsTable.organizationId,org),
        eq(verifiedEnrollmentsTable.learnerId,ticket.learnerId),
        eq(verifiedEnrollmentsTable.status,"active"),
      )).limit(1);
    if(!enrolled) return false;
    const isLearner=ticket.learnerId===input.recipientUserId;
    if(isLearner) {
      const [course]=await db.select({id:courseEnrollmentsTable.id})
        .from(courseEnrollmentsTable).where(and(
          eq(courseEnrollmentsTable.courseId,ticket.courseId),
          eq(courseEnrollmentsTable.userId,input.recipientUserId),
        )).limit(1);
      return isNotificationEligible({
        ...base,activeEnrollment:true,recipientIsLearner:true,activeCourseEnrollment:!!course,
      });
    }
    const [member,assignment]=await Promise.all([
      db.select({role:organizationMembersTable.role}).from(organizationMembersTable)
        .where(and(eq(organizationMembersTable.organizationId,org),
          eq(organizationMembersTable.userId,input.recipientUserId))).limit(1),
      db.select({courseId:courseStaffAssignmentsTable.courseId}).from(courseStaffAssignmentsTable)
        .where(and(eq(courseStaffAssignmentsTable.organizationId,org),
          eq(courseStaffAssignmentsTable.courseId,ticket.courseId),
          eq(courseStaffAssignmentsTable.staffId,input.recipientUserId))).limit(1),
    ]);
    return isNotificationEligible({
      ...base,activeEnrollment:true,staffMemberRole:member[0]?.role??null,
      assignedCourse:!!assignment.length,
    });
  }
  // Security notifications require IdP-signed source evidence, not ticket fallback.
  return false;
}
