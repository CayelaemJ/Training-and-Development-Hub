import type { Request, Response, NextFunction } from "express";
import { getSession, getSessionId } from "../lib/auth";
import { resolvePortal } from "../lib/portalAccess";
import {
  isPrivilegedMutation, isRecentVerifiedMfa, privilegedPortalRoles,
} from "../lib/mfaAssurance";

/** Opt-in, fail-closed guard for admins on every API state-changing request. */
export async function privilegedMfaGuard(req: Request,res: Response,next: NextFunction):Promise<void> {
  if (process.env.CABO_PRIVILEGED_MFA_ENFORCEMENT !== "true" ||
      !isPrivilegedMutation(req.method,req.originalUrl) ||
      !req.isAuthenticated()) {
    next(); return;
  }
  try {
    const {role}=await resolvePortal(req.user.id);
    if (!privilegedPortalRoles.has(role)) { next(); return; }
    const sid=getSessionId(req);
    const session=sid ? await getSession(sid) : null;
    if (!session || session.user.id !== req.user.id ||
        !isRecentVerifiedMfa(session.trusted_mfa)) {
      res.setHeader("Cache-Control","no-store");
      res.status(403).json({error:"mfa_required"});
      return;
    }
    next();
  } catch {
    // Never bypass authorization if the DB, OIDC session or role lookup fails.
    res.setHeader("Cache-Control","no-store");
    res.status(503).json({error:"Privilege verification unavailable"});
  }
}
