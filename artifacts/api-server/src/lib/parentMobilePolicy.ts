export type ParentLink = {
  id: number;
  learnerId: string;
  status: string;
};
export function parentMobileView(
  relationship: ParentLink,
  activeLearnerIds: ReadonlySet<string>,
  verifiedFirstNames: ReadonlyMap<string, string | null>
) {
  const readAllowed =
    relationship.status === "verified" && activeLearnerIds.has(relationship.learnerId);
  return {
    invitationId: relationship.id,
    status: relationship.status,
    // Deliberately omit learner IDs from the native parent response.
    learnerName: readAllowed
      ? (verifiedFirstNames.get(relationship.learnerId) || "Verified learner")
      : null,
    verifiedForRead: readAllowed,
  };
}


export type ActiveLearnerEnrollment = { learnerId: string; organizationId: number };

/**
 * Parent names require the same school-scoped guardian decision as report cards.
 * latestDecisions contains the most recent reviewed decision for each
 * relationship and enrolled school; missing/revoked decisions deny access.
 */
export function approvedNativeParentLearnerIds(
  relationships: ReadonlyArray<ParentLink>,
  activeEnrollments: ReadonlyArray<ActiveLearnerEnrollment>,
  latestDecisions: ReadonlyMap<string, string>
): Set<string> {
  const approved = new Set<string>();
  const schoolsByLearner = new Map<string, number[]>();
  for (const entry of activeEnrollments) {
    const schools = schoolsByLearner.get(entry.learnerId) ?? [];
    schools.push(entry.organizationId);
    schoolsByLearner.set(entry.learnerId, schools);
  }
  for (const relation of relationships) {
    if (relation.status !== "verified") continue;
    for (const organizationId of schoolsByLearner.get(relation.learnerId) ?? []) {
      if (latestDecisions.get(relation.id + ":" + organizationId) === "verified") {
        approved.add(relation.learnerId);
        break;
      }
    }
  }
  return approved;
}
