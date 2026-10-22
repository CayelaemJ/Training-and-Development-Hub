import { Router, type IRouter } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, usersTable, nativeAuthCodesTable } from "@workspace/db";
import { createSession, deleteSession, getSession, getSessionId } from "../lib/auth";
import {
  nativeAuthEnabled, nativeRedirect, validPkceChallenge, validPkceVerifier,
  validCode, validState, randomNativeCode, codeDigest, verifyPkce,
  NATIVE_CODE_SECONDS, NATIVE_SESSION_SECONDS
} from "../lib/nativeAuthPolicy";

const router: IRouter = Router();
const noStore = (_req: unknown, res: import("express").Response, next: () => void) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
};
router.use("/native", noStore);

// Browser phase: authenticate with the existing OIDC identity provider in
// system browser, then create a short-lived code bound to PKCE S256.
router.get("/native/authorize", async (req, res) => {
  if (!nativeAuthEnabled(process.env)) { res.sendStatus(404); return; }
  const redirect = nativeRedirect(req.query.client_id);
  const challenge = req.query.code_challenge;
  const state = req.query.state;
  if (!redirect || !validPkceChallenge(challenge) || !validState(state) ||
      req.query.code_challenge_method !== "S256") {
    res.status(400).json({ error: "invalid_request" }); return;
  }
  if (!req.isAuthenticated()) {
    const returnTo = req.originalUrl;
    // Existing login route has a strict same-origin returnTo policy.
    res.redirect(302, "/api/login?returnTo=" + encodeURIComponent(returnTo));
    return;
  }
  const code = randomNativeCode();
  const codeHash = codeDigest(code);
  await db.insert(nativeAuthCodesTable).values({
    codeHash, clientId: req.query.client_id as "cabo-android" | "cabo-ios", userId: req.user.id, challenge,
    expiresAt: new Date(Date.now() + NATIVE_CODE_SECONDS * 1000),
  });
  // Redirect URI comes solely from the allowlist; the query never contains
  // a bearer access token, password, OAuth refresh token or learner record.
  res.redirect(302, redirect + "?code=" + encodeURIComponent(code) + "&state=" + encodeURIComponent(state));
});

// Device phase: an authorization code can be exchanged exactly once with the
// original verifier. A server-side native session lasts one hour and has no
// provider refresh token or browser cookie.
router.post("/native/token", async (req, res) => {
  if (!nativeAuthEnabled(process.env)) { res.sendStatus(404); return; }
  const { client_id: clientId, code, code_verifier: verifier } = req.body ?? {};
  if (!nativeRedirect(clientId) || !validCode(code) || !validPkceVerifier(verifier)) {
    res.status(400).json({ error: "invalid_request" }); return;
  }
  const digest = codeDigest(code);
  const [pending] = await db.select().from(nativeAuthCodesTable)
    .where(eq(nativeAuthCodesTable.codeHash, digest)).limit(1);
  if (!pending || pending.clientId !== clientId || pending.consumedAt ||
      pending.expiresAt <= new Date() || !verifyPkce(verifier, pending.challenge)) {
    res.status(400).json({ error: "invalid_grant" }); return;
  }
  // Atomic consume ensures two simultaneous exchanges cannot mint two tokens.
  const [used] = await db.update(nativeAuthCodesTable).set({ consumedAt: new Date() })
    .where(and(eq(nativeAuthCodesTable.codeHash, digest),
               eq(nativeAuthCodesTable.clientId, clientId),
               isNull(nativeAuthCodesTable.consumedAt),
               gt(nativeAuthCodesTable.expiresAt, new Date())))
    .returning({ userId: nativeAuthCodesTable.userId });
  if (!used) { res.status(400).json({ error: "invalid_grant" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, used.userId)).limit(1);
  if (!user) { res.status(400).json({ error: "invalid_grant" }); return; }
  const sid = await createSession({
    user: {
      id: user.id, email: user.email, firstName: user.firstName,
      lastName: user.lastName, profileImageUrl: user.profileImageUrl,
    },
    access_token: "cabo-native-session-v1",
    expires_at: Math.floor(Date.now() / 1000) + NATIVE_SESSION_SECONDS,
  });
  res.json({ access_token: sid, token_type: "Bearer", expires_in: NATIVE_SESSION_SECONDS });
});

router.post("/native/logout", async (req, res) => {
  if (!nativeAuthEnabled(process.env)) { res.sendStatus(404); return; }
  const authorization = req.get("authorization");
  if (!authorization?.startsWith("Bearer ") || !req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized" }); return;
  }
  const sid = getSessionId(req);
  if (!sid) { res.sendStatus(401); return; }
  const session = await getSession(sid);
  if (session?.access_token !== "cabo-native-session-v1") {
    res.status(403).json({ error: "invalid_session_type" }); return;
  }
  await deleteSession(sid);
  res.status(204).end();
});

export default router;
