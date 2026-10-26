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

export type ActiveLearnerEnrollment = {
  learnerId: string;
  organizationId: number;
};

/** Parent names require a verified relationship and an approved review at an active school. */
export function approvedNativeParentLearnerIds(
  relationships: ReadonlyArray<ParentLink>,
  activeEnrollments: ReadonlyArray<ActiveLearnerEnrollment>,
  latestDecisions: ReadonlyMap<string, string>
): Set<string> {
  const approved = new Set<string>();
  const organizationsByLearner = new Map<string, Set<number>>();
  for (const enrollment of activeEnrollments) {
    const organizations = organizationsByLearner.get(enrollment.learnerId) ?? new Set<number>();
    organizations.add(enrollment.organizationId);
    organizationsByLearner.set(enrollment.learnerId, organizations);
  }

  for (const relationship of relationships) {
    if (relationship.status !== "verified") continue;
    for (const organizationId of organizationsByLearner.get(relationship.learnerId) ?? []) {
      if (latestDecisions.get(`${relationship.id}:${organizationId}`) === "verified") {
        approved.add(relationship.learnerId);
        break;
      }
    }
  }
  return approved;
}
