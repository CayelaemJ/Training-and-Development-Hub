import { createHash } from "node:crypto";

/**
 * Optional Upstash Redis REST-backed, cross-instance fixed-window rate limiter.
 * No Redis client package is required and the REST token never reaches a browser.
 * Redis Lua makes evaluation of all scopes atomic in one HTTP request.
 */
export type RateLimitRule = readonly [scope: string, max: number, windowMs: number];
export type RateLimitDecision = { allowed: boolean; retryAfter: number };
type RedisConfig = { url: URL; token: string; prefix: string; salt: string };

const SCRIPT = `
for i = 1, #KEYS do
  local count = tonumber(redis.call('GET', KEYS[i]) or '0')
  local maximum = tonumber(ARGV[i * 2 - 1])
  if count >= maximum then
    local ttl = redis.call('PTTL', KEYS[i])
    return {0, math.max(1, math.ceil(math.max(ttl, 1000) / 1000))}
  end
end
for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then
    redis.call('PEXPIRE', KEYS[i], tonumber(ARGV[i * 2]))
  end
end
return {1, 0}
`;

export function redisConfigStatus(env: NodeJS.ProcessEnv = process.env): "disabled" | "enabled" | "invalid" {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url && !token) return "disabled";
  if (!url || !token) return "invalid";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password ||
        parsed.pathname !== "/" || parsed.search || parsed.hash) return "invalid";
    return "enabled";
  } catch {
    return "invalid";
  }
}

function getConfig(env: NodeJS.ProcessEnv): RedisConfig {
  if (redisConfigStatus(env) !== "enabled") throw new Error("Redis rate limiter is not correctly configured");
  const prefix = (env.CABO_REDIS_PREFIX || "cabo-learning").replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 64);
  return {
    url: new URL(env.UPSTASH_REDIS_REST_URL!.trim()),
    token: env.UPSTASH_REDIS_REST_TOKEN!.trim(),
    prefix,
    salt: env.CABO_RATE_LIMIT_SALT || "",
  };
}

export async function takeDistributedRateLimit(
  rules: readonly RateLimitRule[],
  ip: string,
  fetcher: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<RateLimitDecision> {
  if (!rules.length) return { allowed: true, retryAfter: 0 };
  const config = getConfig(env);
  const fingerprint = createHash("sha256").update(config.salt + ":" + ip).digest("hex");
  const keys = rules.map(([scope]) => config.prefix + ":rl:" + scope + ":" + fingerprint);
  const args = rules.flatMap(([, max, windowMs]) => {
    if (!Number.isSafeInteger(max) || max <= 0 || !Number.isSafeInteger(windowMs) || windowMs <= 0) {
      throw new Error("Invalid rate-limit rule");
    }
    return [max, windowMs];
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1750);
  timer.unref();
  try {
    const response = await fetcher(config.url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + config.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["EVAL", SCRIPT, keys.length, ...keys, ...args]),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Redis unavailable");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("result" in payload)) {
      throw new Error("Invalid Redis response");
    }
    const result = (payload as { result: unknown }).result;
    if (!Array.isArray(result) || result.length < 2 ||
        ![0, 1].includes(Number(result[0])) || !Number.isFinite(Number(result[1]))) {
      throw new Error("Invalid Redis limit result");
    }
    return {
      allowed: Number(result[0]) === 1,
      retryAfter: Math.max(1, Math.ceil(Number(result[1]))),
    };
  } finally {
    clearTimeout(timer);
  }
}
