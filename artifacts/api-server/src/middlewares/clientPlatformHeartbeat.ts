import type { NextFunction, Request, Response } from "express";
import { clientPlatformHeartbeatsTable, db } from "@workspace/db";

const platforms = new Set(["web", "ios", "android", "windows"]);
const writeCooldown = new Map<string, number>();
const WRITE_EVERY_MS = 60_000;
const MAX_KEYS = 128;

/** Store only platform/version and an API response code; never a user or device ID. */
export function clientPlatformHeartbeat(req: Request, res: Response, next: NextFunction): void {
  if (!req.originalUrl.startsWith("/api/") || !req.isAuthenticated?.()) return next();
  const platform = req.get("x-cabo-client")?.toLowerCase() ?? "";
  const version = req.get("x-cabo-client-version")?.trim() ?? "";
  if (!platforms.has(platform) || !/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,39}$/.test(version)) return next();

  const key = `${platform}:${version}`;
  const now = Date.now();
  if (now - (writeCooldown.get(key) ?? 0) < WRITE_EVERY_MS) return next();
  // Reserve the interval before the response completes to avoid duplicate writes
  // when many requests from one active client finish together.
  writeCooldown.set(key, now);
  if (writeCooldown.size > MAX_KEYS) {
    for (const [entry, at] of writeCooldown) if (now - at > WRITE_EVERY_MS) writeCooldown.delete(entry);
  }

  res.once("finish", () => {
    void db.insert(clientPlatformHeartbeatsTable).values({
      platform, version, lastSeenAt: new Date(), lastHttpStatus: res.statusCode,
    }).onConflictDoUpdate({
      target: [clientPlatformHeartbeatsTable.platform, clientPlatformHeartbeatsTable.version],
      set: { lastSeenAt: new Date(), lastHttpStatus: res.statusCode },
    }).catch(() => {
      // Health telemetry must never fail the application request or log client metadata.
      writeCooldown.delete(key);
    });
  });
  next();
}
