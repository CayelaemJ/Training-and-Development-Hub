// The signed-in person's profile, look and feel, and display picture, plus
// guardian approval of a child's picture. Personal data, so every response is
// private and uncached.
import express, { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, usersTable, organizationMembersTable, guardianRelationshipsTable,
  userProfilesTable, userAppearanceTable, profilePhotosTable,
} from "@workspace/db";
import { COLORS, MAX_PHOTO_BYTES, cleanText, initials, mayViewPhoto, photoNeedsGuardian, sniffImage } from "../lib/profilePolicy";

const router: IRouter = Router();

function signedIn(req: Request, res: Response): string | null {
  res.setHeader("Cache-Control", "private, no-store");
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Sign in required" }); return null; }
  return req.user!.id;
}

const DEFAULT_APPEARANCE = {
  theme: "system", accent: "clay", fontScale: 1, density: "comfortable", font: "default",
  highContrast: false, reduceMotion: false, underlineLinks: false, captionsDefault: true, pinned: [] as string[],
};

const appearanceBody = z.object({
  theme: z.enum(["system", "light", "dark"]),
  accent: z.enum(COLORS),
  fontScale: z.number().min(0.875).max(1.75),
  density: z.enum(["comfortable", "compact", "spacious"]),
  font: z.enum(["default", "easy_read", "serif", "mono"]),
  highContrast: z.boolean(),
  reduceMotion: z.boolean(),
  underlineLinks: z.boolean(),
  captionsDefault: z.boolean(),
  pinned: z.array(z.string().regex(/^\/[a-z0-9-/]{0,40}$/)).max(8),
}).strict();

async function rolesOf(userId: string) {
  return (await db.select({ role: organizationMembersTable.role }).from(organizationMembersTable)
    .where(eq(organizationMembersTable.userId, userId)).limit(60)).map(r => r.role);
}

router.get("/me/profile", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const [[user], [profile], [appearance], [photo]] = await Promise.all([
    db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1),
    db.select().from(userAppearanceTable).where(eq(userAppearanceTable.userId, userId)).limit(1),
    db.select({ token: profilePhotosTable.token, status: profilePhotosTable.status }).from(profilePhotosTable).where(eq(profilePhotosTable.userId, userId)).limit(1),
  ]);
  const displayName = profile?.displayName ?? "";
  res.json({
    profile: {
      displayName, pronouns: profile?.pronouns ?? "", bio: profile?.bio ?? "",
      avatarStyle: profile?.avatarStyle ?? "initials", avatarColor: profile?.avatarColor ?? "clay",
      initials: initials(displayName, user?.firstName ?? null, user?.lastName ?? null),
      name: displayName || [user?.firstName, user?.lastName].filter(Boolean).join(" "),
    },
    appearance: appearance ? { ...DEFAULT_APPEARANCE, ...appearance, userId: undefined, updatedAt: undefined } : DEFAULT_APPEARANCE,
    photo: photo ? { status: photo.status, url: `/api/profile-photos/${photo.token}` } : null,
  });
});

router.put("/me/profile", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const displayName = cleanText(req.body?.displayName ?? "", 60), pronouns = cleanText(req.body?.pronouns ?? "", 30), bio = cleanText(req.body?.bio ?? "", 280);
  const style = z.enum(["initials", "pattern", "photo"]).safeParse(req.body?.avatarStyle ?? "initials");
  const color = z.enum(COLORS).safeParse(req.body?.avatarColor ?? "clay");
  if (displayName === null || pronouns === null || bio === null || !style.success || !color.success) {
    res.status(400).json({ error: "Keep names and bios short, and leave out links, handles and phone numbers." }); return;
  }
  const values = { displayName, pronouns, bio, avatarStyle: style.data, avatarColor: color.data, updatedAt: new Date() };
  await db.insert(userProfilesTable).values({ userId, ...values }).onConflictDoUpdate({ target: userProfilesTable.userId, set: values });
  res.json({ ok: true });
});

router.put("/me/appearance", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const body = appearanceBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Those appearance settings are not available." }); return; }
  const values = { ...body.data, updatedAt: new Date() };
  await db.insert(userAppearanceTable).values({ userId, ...values }).onConflictDoUpdate({ target: userAppearanceTable.userId, set: values });
  res.json({ ok: true });
});

router.put("/me/photo", express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_PHOTO_BYTES }), async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const type = sniffImage(bytes);
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES || !type) { res.status(400).json({ error: "Choose a JPEG, PNG or WebP picture under 300 KB." }); return; }
  const status = photoNeedsGuardian(await rolesOf(userId)) ? "pending_guardian" : "approved";
  const values = { token: randomUUID(), contentType: type, bytes, sizeBytes: bytes.length, status, decidedBy: null, decidedAt: null, note: null, createdAt: new Date() };
  await db.insert(profilePhotosTable).values({ userId, ...values }).onConflictDoUpdate({ target: profilePhotosTable.userId, set: values });
  res.json({ status, notice: status === "pending_guardian" ? "Your parent or guardian needs to approve this picture before others can see it." : null });
});

router.delete("/me/photo", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  await db.delete(profilePhotosTable).where(eq(profilePhotosTable.userId, userId));
  res.json({ ok: true });
});

router.get("/profile-photos/:token", async (req, res) => {
  const viewerId = signedIn(req, res); if (!viewerId) return;
  const token = z.uuid().safeParse(req.params.token);
  if (!token.success) { res.sendStatus(404); return; }
  const [photo] = await db.select().from(profilePhotosTable).where(eq(profilePhotosTable.token, token.data)).limit(1);
  if (!photo) { res.sendStatus(404); return; }
  let sharesSchool = false, isGuardian = false;
  if (viewerId !== photo.userId) {
    const [viewerOrgs, ownerOrgs, guardian] = await Promise.all([
      db.select({ id: organizationMembersTable.organizationId }).from(organizationMembersTable).where(eq(organizationMembersTable.userId, viewerId)).limit(60),
      db.select({ id: organizationMembersTable.organizationId }).from(organizationMembersTable).where(eq(organizationMembersTable.userId, photo.userId)).limit(60),
      db.select({ id: guardianRelationshipsTable.id }).from(guardianRelationshipsTable).where(and(
        eq(guardianRelationshipsTable.guardianId, viewerId), eq(guardianRelationshipsTable.learnerId, photo.userId), eq(guardianRelationshipsTable.status, "verified"))).limit(1),
    ]);
    const mine = new Set(viewerOrgs.map(o => o.id));
    sharesSchool = ownerOrgs.some(o => mine.has(o.id));
    isGuardian = guardian.length > 0;
  }
  if (!mayViewPhoto({ viewerId, ownerId: photo.userId, status: photo.status, sharesSchool, isGuardian })) { res.sendStatus(404); return; }
  res.setHeader("Content-Type", photo.contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.setHeader("Cache-Control", "private, max-age=300");
  // Not HTML: bytes were identified as JPEG/PNG/WebP by magic number on upload and are
  // served with that type, nosniff and a sandbox CSP, so a browser never renders them as markup.
  res.send(photo.bytes); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
});

/** Pictures of the guardian's verified children that wait for a decision. */
router.get("/me/photo-approvals", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const children = await db.select({ learnerId: guardianRelationshipsTable.learnerId }).from(guardianRelationshipsTable)
    .where(and(eq(guardianRelationshipsTable.guardianId, userId), eq(guardianRelationshipsTable.status, "verified"))).limit(30);
  if (!children.length) { res.json([]); return; }
  const rows = await db.select({ learnerId: profilePhotosTable.userId, token: profilePhotosTable.token, status: profilePhotosTable.status, firstName: usersTable.firstName })
    .from(profilePhotosTable).innerJoin(usersTable, eq(usersTable.id, profilePhotosTable.userId))
    .where(and(inArray(profilePhotosTable.userId, children.map(c => c.learnerId)), eq(profilePhotosTable.status, "pending_guardian")));
  res.json(rows.map(r => ({ learnerId: r.learnerId, childName: r.firstName ?? "Your child", url: `/api/profile-photos/${r.token}` })));
});

router.post("/me/photo-approvals/:learnerId", async (req, res) => {
  const userId = signedIn(req, res); if (!userId) return;
  const decision = z.enum(["approved", "declined"]).safeParse(req.body?.decision);
  const learnerId = z.string().min(1).max(160).safeParse(req.params.learnerId);
  if (!decision.success || !learnerId.success) { res.sendStatus(400); return; }
  const [guardian] = await db.select({ id: guardianRelationshipsTable.id }).from(guardianRelationshipsTable).where(and(
    eq(guardianRelationshipsTable.guardianId, userId), eq(guardianRelationshipsTable.learnerId, learnerId.data), eq(guardianRelationshipsTable.status, "verified"))).limit(1);
  if (!guardian) { res.sendStatus(404); return; }
  const changed = await db.update(profilePhotosTable).set({ status: decision.data, decidedBy: userId, decidedAt: new Date() })
    .where(and(eq(profilePhotosTable.userId, learnerId.data), eq(profilePhotosTable.status, "pending_guardian"))).returning({ token: profilePhotosTable.token });
  if (!changed.length) { res.sendStatus(404); return; }
  res.json({ ok: true });
});

export default router;
