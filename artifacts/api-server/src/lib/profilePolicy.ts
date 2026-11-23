/**
 * Profiles, look and feel, and display pictures.
 *
 * - Anyone can choose a display name, pronouns, a short bio, a generated
 *   avatar (initials or pattern in a colour) and how the app looks.
 * - Photos are small images (JPEG, PNG or WebP, at most 300 KB), checked by
 *   their first bytes, not their declared type.
 * - A learner's photo is personal information about a child under POPIA and
 *   the Botswana DPA. It is shown to nobody else until a school-verified
 *   guardian approves it. Adults' photos show at once.
 * - Pictures are visible only to the person, people who share a school with
 *   them, and their verified guardians.
 */
export const COLORS = ["clay", "teal", "gold", "ink", "violet", "rose", "sky", "leaf"] as const;
export type AvatarColor = (typeof COLORS)[number];
export const MAX_PHOTO_BYTES = 300 * 1024;

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** Identify an image from its first bytes; anything else is refused. */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** A learner-only account needs guardian approval before others see a photo. */
export function photoNeedsGuardian(roles: readonly string[]): boolean {
  const staff = roles.some(r => ["owner", "admin", "teacher", "assessor"].includes(r));
  return roles.includes("learner") && !staff;
}

export function mayViewPhoto(args: { viewerId: string; ownerId: string; status: string; sharesSchool: boolean; isGuardian: boolean }): boolean {
  if (args.viewerId === args.ownerId) return true;
  if (args.isGuardian) return args.status !== "declined";
  return args.status === "approved" && args.sharesSchool;
}

/** Trim and strip control characters; refuse links in free text shown to others. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g, " ").replace(/\s+/g, " ").trim();
  if (text.length > max) return null;
  if (/https?:\/\/|www\.|@[a-z0-9_.]{3,}|(?:\+?\d[\s().-]*){7,}/i.test(text)) return null;
  return text;
}

export function initials(displayName: string, firstName: string | null, lastName: string | null): string {
  const source = displayName.trim() || [firstName, lastName].filter(Boolean).join(" ");
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toLocaleUpperCase();
}
