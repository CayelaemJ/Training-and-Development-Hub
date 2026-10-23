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
