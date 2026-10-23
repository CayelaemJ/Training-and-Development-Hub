import type { Request, Response, NextFunction } from "express";

/**
 * Defensive per-IP fixed-window limiter. No unauthenticated route can bypass this
 * middleware. Set TRUST_PROXY_HOPS=1 ONLY when the ingress removes client-supplied
 * X-Forwarded-For values. A shared edge/Redis limiter is required for replicas.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 50000;

function take(key: string, max: number, windowMs: number, at: number): { allowed: boolean; retryAfter: number } {
  let state = buckets.get(key);
  if (!state || state.resetAt <= at) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [id, row] of buckets) if (row.resetAt <= at) buckets.delete(id);
      if (buckets.size >= MAX_BUCKETS) return { allowed: false, retryAfter: 60 };
    }
    state = { count: 0, resetAt: at + windowMs };
    buckets.set(key, state);
  }
  state.count++;
  return { allowed: state.count <= max, retryAfter: Math.max(1, Math.ceil((state.resetAt - at) / 1000)) };
}

const sweep = setInterval(() => {
  const at = Date.now();
  for (const [id, state] of buckets) if (state.resetAt <= at) buckets.delete(id);
}, 5 * 60_000);
sweep.unref();

export function apiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const path = req.originalUrl.split("?", 1)[0].toLowerCase();
  if (path === "/api/health") return next();

  const ip = String(req.ip || req.socket.remoteAddress || "unknown");
  const limits: Array<[string, number, number]> = [["all", 240, 60_000]];
  if (/\/(?:login|test-login|auth|callback|reset-password|forgot-password)(?:\/|$)/.test(path)) {
    limits.push(["authentication", 12, 10 * 60_000]);
  }
  if (/\/(?:storage|upload|material)(?:s|\/|-|$)/.test(path)) {
    limits.push(["uploads", 24, 10 * 60_000]);
  }
  if (/\/(?:generate|ai|quiz|written-exam|assessment-paper)(?:s|\/|-|$)/.test(path)) {
    limits.push(["generation", 30, 10 * 60_000]);
  }
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    limits.push(["mutations", 90, 60_000]);
  }

  const at = Date.now();
  for (const [scope, max, windowMs] of limits) {
    const result = take(scope + ":" + ip, max, windowMs, at);
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfter));
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }
  }
  next();
}
