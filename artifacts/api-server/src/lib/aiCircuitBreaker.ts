/**
 * Per-provider circuit breaker for AI calls. After a provider-wide failure the
 * provider is skipped for a short cooldown, so a bad key, an exhausted quota or
 * an outage fails fast instead of adding a slow failing call to every request.
 * Cooldowns are short for errors that are usually transient.
 */
export function cooldownForStatus(status: number | undefined): number {
  if (status === 402) return 30 * 60_000; // payment required: will not fix itself soon
  if (status === 401 || status === 403) return 60_000; // credentials: give an operator time to fix
  if (status === 429) return 30_000; // rate limit without a retry-after
  return 10_000; // 5xx or connection error: usually a blip
}

export function createCircuitBreaker(now: () => number = Date.now) {
  const blockedUntil = new Map<string, number>();
  return {
    /** Milliseconds left before this provider may be tried again (0 = closed). */
    remainingMs(provider: string): number {
      return Math.max(0, (blockedUntil.get(provider) ?? 0) - now());
    },
    postpone(provider: string, ms: number): void {
      const until = now() + Math.max(0, Math.min(ms, 60 * 60_000));
      blockedUntil.set(provider, Math.max(blockedUntil.get(provider) ?? 0, until));
    },
    reset(provider: string): void {
      blockedUntil.delete(provider);
    },
  };
}

export const providerCircuit = createCircuitBreaker();
