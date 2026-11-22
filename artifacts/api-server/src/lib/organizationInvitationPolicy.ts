/**
 * Consent-based organization membership.
 *
 * Previously a manager could add any registered account to an organization by
 * email. Because any signed-in user can create an organization, that let any
 * user (a) confirm whether an email has a CABO account (201 vs 404) and
 * (b) read that person's name and email through the members list, without the
 * person's knowledge. Learners may be minors.
 *
 * Now a manager only creates an invitation for a normalized email. The response
 * is identical whether or not the email has an account. A membership exists
 * only after the account holder for that email accepts.
 *
 * Pure functions only (no database, no framework imports) so the rules are
 * unit-tested directly with node:test.
 */

export const INVITABLE_ROLES = ["admin", "teacher", "assessor", "learner"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];
export type InvitationStatus = "pending" | "accepted" | "declined" | "revoked";
export type InvitationDecision = "accepted" | "declined";

const MAX_EMAIL_LENGTH = 320;

/** Lowercase and trim; returns null for anything that is not a plausible single address. */
export function normalizeInvitationEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > MAX_EMAIL_LENGTH) return null;
  // One "@", non-empty local part and a dotted domain; no whitespace or control characters.
  if (!/^[^\s@\u0000-\u001f\u007f]+@[^\s@\u0000-\u001f\u007f]+\.[^\s@\u0000-\u001f\u007f]+$/.test(email)) return null;
  return email;
}

export function isInvitableRole(value: unknown): value is InvitableRole {
  return typeof value === "string" && (INVITABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Who may invite which role. Owners and platform superadmins may invite any
 * invitable role; admins may invite every role except admin. Everyone else may
 * not invite. "owner" is never invitable (ownership is not transferable here).
 */
export function mayInvite(actorRole: string | null | undefined, targetRole: string, isSuperadmin: boolean): boolean {
  if (!isInvitableRole(targetRole)) return false;
  if (isSuperadmin || actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole !== "admin";
  return false;
}

/**
 * The single response body sent for every accepted invite request, so the
 * caller cannot tell whether the email belongs to an account.
 */
export function uniformInvitationResponse() {
  return {
    status: "invited" as const,
    message:
      "If this email belongs to a CABO account, that person will see the invitation and can accept or decline it. Nobody is added until they accept.",
  };
}

export type InvitationForDecision = {
  status: string;
  email: string;
  expiresAt: Date;
};

/**
 * The email an account may claim invitations for. The stored account email is
 * copied from identity-provider claims without requiring verification, so it
 * is only trusted when the current session also carries the same address as a
 * provider-verified email (set only from a validated ID token with
 * email_verified=true). Returns null when the two are missing or differ.
 */
export function verifiedInviteeEmail(
  accountEmail: string | null | undefined,
  verifiedSessionEmail: string | null | undefined,
): string | null {
  const account = normalizeInvitationEmail(accountEmail);
  const verified = normalizeInvitationEmail(verifiedSessionEmail);
  return account !== null && account === verified ? account : null;
}

/**
 * An invitation may be answered only while pending and unexpired, and only by
 * an account whose verified email (see verifiedInviteeEmail) matches it.
 */
export function mayRespondToInvitation(
  invitation: InvitationForDecision | null | undefined,
  inviteeEmail: string | null | undefined,
  now: Date,
): boolean {
  if (!invitation || invitation.status !== "pending") return false;
  if (!(invitation.expiresAt instanceof Date) || Number.isNaN(invitation.expiresAt.getTime())) return false;
  if (invitation.expiresAt.getTime() <= now.getTime()) return false;
  const normalized = normalizeInvitationEmail(inviteeEmail);
  return normalized !== null && normalized === invitation.email;
}

export function isInvitationDecision(value: unknown): value is InvitationDecision {
  return value === "accepted" || value === "declined";
}
