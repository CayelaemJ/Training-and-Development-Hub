/**
 * Class chat safety rules.
 *
 * - One channel per academic course; staff open and close it.
 * - No direct messages: learners only post in their own course channels.
 * - Messages that share contact details, links or invitations to move off the
 *   platform are held for a teacher before classmates can see them, because
 *   moving a child to a private channel is a common grooming step.
 * - Assigned teachers and school leaders moderate; every moderation action is
 *   recorded. Reports open an accountability case.
 */
export const MAX_MESSAGE_LENGTH = 1000;
export const RATE_LIMIT = { messages: 8, windowSeconds: 60 } as const;
export const REPORT_REASONS = ["bullying", "unsafe_contact", "inappropriate", "self_harm_concern", "spam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ScreenResult = { status: "visible" } | { status: "held"; reason: string };

const PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ["email_address", /[^\s@]+@[^\s@]+\.[a-z]{2,}/i],
  // 7+ digits allowing spaces, dots, dashes and brackets, optionally with +27/+267.
  ["phone_number", /(?:\+?\d[\s().-]*){7,}/],
  ["link", /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|co\.za|co\.bw|org|net|io|me|app|ly|gg)\b/i],
  ["social_handle", /(?:^|\s)@[a-z0-9_.]{3,}/i],
  ["off_platform_invite", /\b(?:whats\s?app|telegram|snap\s?chat|instagram|tiktok|signal|discord|kik|dm me|inbox me|text me|call me|my number|meet (?:me|up)|come alone|don'?t tell)\b/i],
];
const ABUSIVE = /\b(?:kill yourself|kys|go die|ugly\s+(?:loser|freak)|nobody likes you)\b/i;
const SELF_HARM = /\b(?:want to die|kill myself|end it all|hurt myself|self[-\s]?harm|suicid(?:e|al))\b/i;

/** Decide whether a new message is shown at once or held for a teacher. */
export function screenMessage(body: string): ScreenResult {
  if (SELF_HARM.test(body)) return { status: "held", reason: "possible_self_harm" };
  if (ABUSIVE.test(body)) return { status: "held", reason: "abusive_language" };
  for (const [reason, pattern] of PATTERNS) if (pattern.test(body)) return { status: "held", reason };
  return { status: "visible" };
}

/** Held messages that suggest a child may be at risk open a safeguarding case. */
export function screenNeedsCase(reason: string | null): { kind: "safeguarding"; severity: "high" } | null {
  return reason === "possible_self_harm" || reason === "off_platform_invite" ? { kind: "safeguarding", severity: "high" } : null;
}

export function normaliseBody(input: unknown): string | null {
  if (typeof input !== "string") return null;
  // Strip control characters except newline, collapse runs of blank lines.
  const text = input.replace(/[\u0000-\u0009\u000b-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g, "")
    .replace(/\n{3,}/g, "\n\n").trim();
  return text.length >= 1 && text.length <= MAX_MESSAGE_LENGTH ? text : null;
}

export type ChatParticipant = {
  isLearner: boolean;
  isAssignedStaff: boolean;
  isSchoolLeader: boolean;
};

export function mayRead(p: ChatParticipant): boolean {
  return p.isLearner || p.isAssignedStaff || p.isSchoolLeader;
}

export function mayModerate(p: ChatParticipant): boolean {
  return p.isAssignedStaff || p.isSchoolLeader;
}

export function mayPost(p: ChatParticipant, channelOpen: boolean, mutedUntil: Date | null, now: Date): boolean {
  if (!mayRead(p)) return false;
  if (mayModerate(p)) return true; // staff may post in a closed channel to explain why
  return channelOpen && !(mutedUntil && mutedUntil > now);
}

export function withinRateLimit(recentCount: number): boolean {
  return recentCount < RATE_LIMIT.messages;
}

/** Classmates see a first name and initial, never a full name or account id. */
export function displayName(firstName: string | null, lastName: string | null, staff: boolean): string {
  const first = (firstName ?? "").trim().slice(0, 40);
  const initial = (lastName ?? "").trim().slice(0, 1);
  const name = [first, initial ? initial + "." : ""].filter(Boolean).join(" ") || (staff ? "Teacher" : "Classmate");
  return staff ? `${name} (teacher)` : name;
}

/** What a viewer may see of one message. */
export function messageVisibleTo(
  m: { status: string; authorId: string | null },
  viewerId: string,
  moderator: boolean,
): "full" | "own_held" | "hidden" {
  if (moderator) return "full";
  if (m.status === "visible") return "full";
  if (m.status === "held" && m.authorId === viewerId) return "own_held";
  return "hidden";
}
