/**
 * Server-side gates for learner-initiated guardian invitations and school
 * transfer requests.
 *
 * The web client disabled both actions on 2026-10-26 (commit b60648b) while
 * child/guardian verification and transfer rules are incomplete
 * (docs/INSTITUTION_TRANSFERS_AND_GUARDIANS.md). The API endpoints stayed
 * reachable, so any signed-in account could still call them directly:
 * - POST /guardian-relationships answered 400 for an unknown email and 201 for
 *   a registered one (an account-existence oracle) and created a pending link
 *   to any account;
 * - POST /institution-records/transfers answered 404 for an unknown school id,
 *   letting callers enumerate organizations, and filed requests to any school.
 *
 * Both now require an explicit opt-in so the server matches the product
 * decision. Defaults are off; enabling is an owner decision.
 */
type Env = Record<string, string | undefined>;

export function learnerGuardianInvitesEnabled(env: Env): boolean {
  return env.ENABLE_LEARNER_GUARDIAN_INVITES === "true";
}

export function learnerTransferRequestsEnabled(env: Env): boolean {
  return env.ENABLE_LEARNER_TRANSFER_REQUESTS === "true";
}

/** One body for every accepted guardian request, whether or not the email has an account. */
export function uniformGuardianRequestResponse() {
  return {
    status: "requested" as const,
    message:
      "If this email belongs to a CABO account, that person will see your request and can accept or decline it.",
  };
}
