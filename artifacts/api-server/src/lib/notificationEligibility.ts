/**
 * Conservative notification eligibility. A verified relationship does NOT
 * imply marketing consent; explicit school/event preferences are mandatory.
 */
export type NotificationKind="guardian_review_requested"|"learner_support_updated"|"account_security";
export type NoticeSource={kind:"support_ticket"|"guardian_relationship";id:number};
export type EligibilityEvidence={
  kind:NotificationKind;
  source:NoticeSource;
  emailMatches:boolean;
  preference:{optedIn:boolean;confirmedAt:Date|null;revokedAt:Date|null}|null;
  recipientIsLearner?:boolean;
  activeEnrollment?:boolean;
  activeCourseEnrollment?:boolean;
  staffMemberRole?:string|null;
  assignedCourse?:boolean;
  verifiedGuardianRelationship?:boolean;
  latestGuardianDecision?:string|null;
};

export function isNotificationEligible(e:EligibilityEvidence):boolean {
  if(!e.emailMatches || !e.preference?.optedIn ||
      !(e.preference.confirmedAt instanceof Date) ||
      !Number.isFinite(e.preference.confirmedAt.getTime()) ||
      e.preference.revokedAt !== null ||
      !Number.isSafeInteger(e.source.id) || e.source.id < 1 ||
      !e.activeEnrollment) return false;
  if(e.kind==="guardian_review_requested") {
    return e.source.kind==="guardian_relationship" &&
      e.verifiedGuardianRelationship===true &&
      e.latestGuardianDecision==="verified";
  }
  if(e.kind==="learner_support_updated") {
    if(e.source.kind!=="support_ticket") return false;
    return (e.recipientIsLearner===true && e.activeCourseEnrollment===true) ||
      (["teacher","assessor"].includes(e.staffMemberRole??"") &&
       e.assignedCourse===true);
  }
  // Security alerts need a separate IdP-owned, owner-verified event source.
  return false;
}
