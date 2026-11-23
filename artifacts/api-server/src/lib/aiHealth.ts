/**
 * Live AI health check: one tiny, real model call with a fixed synthetic
 * prompt (never learner data), validated before it counts as healthy.
 *
 * The result is cached (default 10 minutes) and concurrent callers share one
 * in-flight check, so a public health endpoint cannot be used to run up AI
 * usage. Errors are reduced to a status; provider messages are never returned.
 */
export type AiHealthStatus = "healthy" | "unavailable" | "not_configured";
export type AiHealthResult = {
  status: AiHealthStatus;
  model: string | null;
  latencyMs: number | null;
  checkedAt: string;
  cached: boolean;
};
type Completer = (args: {
  system: string;
  payload: unknown;
  validate: (value: unknown) => true;
  maxCompletionTokens: number;
  operation: "provider_smoke_test";
}) => Promise<{ modelId: string }>;

export const AI_HEALTH_PROMPT =
  'This is an automated health check. Reply with exactly this JSON object and nothing else: {"ok":true,"sum":5}';
export const AI_HEALTH_PAYLOAD = { task: "Add 2 and 3", expected: { ok: true, sum: 5 } };

/** Accept only the exact expected answer, so a confused or truncated model is not "healthy". */
export function validHealthAnswer(value: unknown): true {
  const v = value as { ok?: unknown; sum?: unknown } | null;
  if (!v || v.ok !== true || Number(v.sum) !== 5) throw new Error("Unexpected health-check answer");
  return true;
}

export function createAiHealthCheck(deps: {
  complete: Completer;
  configured: () => boolean;
  now?: () => number;
  ttlMs?: number;
  timeoutMs?: number;
}) {
  const now = deps.now ?? Date.now;
  const ttlMs = deps.ttlMs ?? 10 * 60_000;
  const timeoutMs = deps.timeoutMs ?? 20_000;
  let last: { at: number; result: Omit<AiHealthResult, "cached"> } | null = null;
  let inFlight: Promise<Omit<AiHealthResult, "cached">> | null = null;

  async function run(): Promise<Omit<AiHealthResult, "cached">> {
    const started = now();
    const checkedAt = new Date(started).toISOString();
    if (!deps.configured()) return { status: "not_configured", model: null, latencyMs: null, checkedAt };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const answer = await Promise.race([
        deps.complete({
          system: AI_HEALTH_PROMPT,
          payload: AI_HEALTH_PAYLOAD,
          validate: validHealthAnswer,
          maxCompletionTokens: 60,
          operation: "provider_smoke_test",
        }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("AI health check timed out")), timeoutMs); }),
      ]);
      return { status: "healthy", model: answer.modelId.slice(0, 120), latencyMs: Math.max(0, now() - started), checkedAt };
    } catch {
      return { status: "unavailable", model: null, latencyMs: Math.max(0, now() - started), checkedAt };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return async function check(): Promise<AiHealthResult> {
    if (last && now() - last.at < ttlMs) return { ...last.result, cached: true };
    if (!inFlight) {
      inFlight = run().then(result => {
        last = { at: now(), result };
        return result;
      }).finally(() => { inFlight = null; });
    }
    return { ...(await inFlight), cached: false };
  };
}
