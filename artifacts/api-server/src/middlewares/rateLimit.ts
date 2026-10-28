import type { Request, Response, NextFunction } from "express";
import { redisConfigStatus, takeDistributedRateLimit, type RateLimitRule } from "../lib/redisRateLimit";

/**
 * When Upstash Redis is configured, all API replicas share the same atomic
 * limiter. Without Redis, the bounded in-memory limiter is for single-replica
 * development and demos only. Incomplete config/outage fails closed (503).
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

function rulesFor(req: Request): RateLimitRule[] {
  const url = req.originalUrl.split("?", 1)[0].toLowerCase();
  const limits: RateLimitRule[] = [["all", 240, 60_000]];
  if (/\\/(?:login|test-login|auth|callback|reset-password|forgot-password)(?:\\/|$)/.test(url)) {
    limits.push(["authentication", 12, 10 * 60_000]);
  }
  if (/\\/(?:storage|upload|material)(?:s|\\/|-|$)/.test(url)) {
    limits.push(["uploads", 24, 10 * 60_000]);
  }
  if (/\\/(?:generate|ai|quiz|written-exam|assessment-paper)(?:s|\\/|-|$)/.test(url)) {
    limits.push(["generation", 30, 10 * 60_000]);
  }
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    limits.push(["mutations", 90, 60_000]);
  }
  return limits;
}

function rejectLimit(res: Response, retryAfter: number): void {
  res.setHeader("Retry-After", String(retryAfter));
  res.setHeader("Cache-Control", "no-store");
  res.status(429).json({ error: "Too many requests. Please try again later." });
}

export function apiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const path = req.originalUrl.split("?", 1)[0].toLowerCase();
  if (path === "/api/healthz" || path === "/api/readyz" || path === "/api/health") {
    return next();
  }
  const ip = String(req.ip || req.socket.remoteAddress || "unknown");
  const limits = rulesFor(req);
  const redis = redisConfigStatus();

  if (redis !== "disabled") {
    // Never silently fall back to per-process limits on a multi-replica service.
    if (redis === "invalid") {
      res.status(503).json({ error: "Request protection is unavailable." });
      return;
    }
    void takeDistributedRateLimit(limits, ip)
      .then(decision => {
        if (!decision.allowed) return rejectLimit(res, decision.retryAfter);
        next();
      })
      .catch(() => {
        // Do not log Redis URLs, authentication tokens, IP addresses or the body.
        res.setHeader("Cache-Control", "no-store");
        res.status(503).json({ error: "Request protection is temporarily unavailable." });
      });
    return;
  }

  const at = Date.now();
  for (const [scope, max, windowMs] of limits) {
    const result = take(scope + ":" + ip, max, windowMs, at);
    if (!result.allowed) return rejectLimit(res, result.retryAfter);
  }
  next();
}
