import { createHash } from "node:crypto";
import { redisConfigStatus } from "./redisRateLimit";

type Env = NodeJS.ProcessEnv;
/**
 * Bounded, shared Redis liveness check for /readyz.
 * Disabled by default to preserve free-tier quota; checks no user/IP data.
 * Cached across concurrent requests for five minutes on success.
 */
export function createRedisReadinessProbe(
  fetcher: typeof fetch = fetch,
  clock: () => number = Date.now,
) {
  let state: { key: string; checkedAt: number; healthy: boolean } | undefined;
  let inFlight: { key: string; promise: Promise<boolean> } | undefined;

  return async (env: Env = process.env): Promise<boolean> => {
    if (redisConfigStatus(env) !== "enabled") return false;
    const url = env.UPSTASH_REDIS_REST_URL!.trim();
    const token = env.UPSTASH_REDIS_REST_TOKEN!.trim();
    const key = createHash("sha256").update(url).update("\0").update(token).digest("hex");
    const maxAge = state?.healthy ? 300_000 : 30_000;
    if (state?.key === key && clock()-state.checkedAt < maxAge) return state.healthy;
    if (inFlight?.key === key) return inFlight.promise;
    const promise = (async () => {
      let healthy = false;
      try {
        const response = await fetcher(url, {
          method: "POST",
          headers: {Authorization: "Bearer "+token,"Content-Type":"application/json"},
          body: JSON.stringify(["PING"]),
          signal: AbortSignal.timeout(1200),
        });
        if (response.ok) {
          const body: unknown = await response.json();
          healthy = Boolean(body && typeof body === "object" && "result" in body &&
            (body as {result:unknown}).result === "PONG");
        }
      } catch { /* readiness fails closed */ }
      state = { key, checkedAt:clock(), healthy };
      return healthy;
    })();
    inFlight = {key,promise};
    try { return await promise; }
    finally { if (inFlight?.promise === promise) inFlight = undefined; }
  };
}
export const checkRedisReadiness = createRedisReadinessProbe();
