/**
 * Rules for sharing a learner's passport with a university, college or
 * employer. Pure functions: the routes load data and enforce these.
 *
 * - Default is no access. Only an active, unexpired, unrevoked share opens
 *   the sections it names, to staff of the one recipient institution.
 * - A learner with a verified parent or guardian needs that guardian's
 *   approval before a share becomes active (children's personal information,
 *   POPIA s35 / Botswana DPA 2024 consent of a competent person).
 * - Schools are not recipients: moving schools uses the transfer flow.
 */
export const SHARE_SCOPES = ["results", "learning_dna", "skills", "verified_achievements", "journey"] as const;
export type ShareScope = (typeof SHARE_SCOPES)[number];
export const SHARE_PURPOSES = ["admission", "bursary", "employment", "internship"] as const;
export type SharePurpose = (typeof SHARE_PURPOSES)[number];
export type ShareStatus = "pending_guardian" | "active" | "declined" | "revoked";

export const SHARE_DAYS = { min: 7, max: 365, default: 90 } as const;
export const MAX_OPEN_SHARES = 20;
/** Roles inside the recipient institution that may open a shared passport. */
export const RECIPIENT_VIEWER_ROLES = ["owner", "admin"] as const;
const SCHOOL_TYPES = new Set(["school", "highschool", "primary", "primaryschool", "secondary"]);

export const SCOPE_LABEL: Record<ShareScope, string> = {
  results: "Published results by subject",
  learning_dna: "Learning DNA (educator-reviewed concepts)",
  skills: "Skills and evidence (self-reported)",
  verified_achievements: "Achievements verified by an institution",
  journey: "Learning journey and milestones",
};

/** Any organisation that is not a school can receive a share (universities, colleges, employers). */
export function isRecipientInstitution(institutionType: string | null | undefined): boolean {
  return !institutionType || !SCHOOL_TYPES.has(institutionType.toLowerCase());
}

export type ShareRequest = { organizationId: number; purpose: SharePurpose; scope: ShareScope[]; days: number };
export function parseShareRequest(body: unknown): ShareRequest | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return null;
  const organizationId = Number(b.organizationId);
  const days = b.days === undefined ? SHARE_DAYS.default : Number(b.days);
  if (!Number.isInteger(organizationId) || organizationId <= 0) return null;
  if (typeof b.purpose !== "string" || !(SHARE_PURPOSES as readonly string[]).includes(b.purpose)) return null;
  if (!Number.isInteger(days) || days < SHARE_DAYS.min || days > SHARE_DAYS.max) return null;
  if (!Array.isArray(b.scope) || b.scope.length === 0 || b.scope.length > SHARE_SCOPES.length) return null;
  if (!b.scope.every(s => typeof s === "string" && (SHARE_SCOPES as readonly string[]).includes(s))) return null;
  const scope = [...new Set(b.scope as ShareScope[])];
  return { organizationId, purpose: b.purpose as SharePurpose, scope, days };
}

export function initialStatus(hasVerifiedGuardian: boolean): ShareStatus {
  return hasVerifiedGuardian ? "pending_guardian" : "active";
}

/** What a recipient (or the learner's own list) sees as the share's state right now. */
export function effectiveStatus(share: { status: string; expiresAt: Date; revokedAt: Date | null }, now = new Date()): ShareStatus | "expired" {
  if (share.revokedAt || share.status === "revoked") return "revoked";
  if (share.status === "active" && share.expiresAt <= now) return "expired";
  return share.status as ShareStatus;
}

export function recipientMayView(share: { status: string; expiresAt: Date; revokedAt: Date | null }, viewerRole: string | null | undefined, now = new Date()): boolean {
  return effectiveStatus(share, now) === "active" && !!viewerRole && (RECIPIENT_VIEWER_ROLES as readonly string[]).includes(viewerRole);
}

/** Keep only the sections the learner chose; anything else is never sent. */
export function scopedSnapshot<T extends Partial<Record<ShareScope, unknown>>>(all: T, scope: readonly string[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of SHARE_SCOPES) if (scope.includes(key) && key in all) (out as Record<string, unknown>)[key] = all[key];
  return out;
}

export function sharingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.ENABLE_PASSPORT_SHARING === "true") return true;
  // The isolated demo pilot shows the feature with fictional data.
  return (env.CABO_ENVIRONMENT ?? env.RAILWAY_ENVIRONMENT_NAME) === "testing" && env.CABO_TEST_DATABASE_ISOLATED === "true";
}
