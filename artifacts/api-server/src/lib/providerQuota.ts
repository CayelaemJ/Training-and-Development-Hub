/** Respect upstream quotas; never route around a provider's usage restriction. */
export class ProviderQuotaError extends Error {
  retryAfterSeconds: number;
  constructor(seconds: number) {
    super(`The learning provider has reached its usage allowance. Your material is saved. Please try again in ${Math.max(1, Math.ceil(seconds))} seconds. The administrator can check the provider quota if this keeps happening.`);
    this.name = 'ProviderQuotaError';
    this.retryAfterSeconds = Math.max(1, Math.ceil(seconds));
  }
}
export function quotaDelay(error: unknown, now = Date.now()): number | null {
  const e = error as {status?: number; headers?: {get(name: string): string | null}};
  if (e?.status !== 429) return null;
  const header = e.headers?.get('retry-after');
  if (!header) return 60000;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1000, Math.ceil(seconds * 1000));
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(1000, date - now) : 60000;
}
export function createProviderScheduler(
  now = () => Date.now(),
  sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
  options: { fastFailOnQuota?: boolean } = {},
) {
  let tail: Promise<unknown> = Promise.resolve();
  let blockedUntil = 0;
  return async function schedule<T>(operation: () => Promise<T>, deadline: number): Promise<T> {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const wait = Math.max(0, blockedUntil - now());
        if (wait > 0 && options.fastFailOnQuota) throw new ProviderQuotaError(wait / 1000);
        if (now() + wait + 1000 >= deadline) throw new ProviderQuotaError(Math.max(wait / 1000, 1));
        if (wait) await sleep(wait);
        try { return await operation(); }
        catch (error) {
          const delay = quotaDelay(error, now());
          if (delay === null) throw error;
          blockedUntil = now() + delay;
          // A routed request can fail over immediately without hammering this provider.
          if (options.fastFailOnQuota || attempt === 2) throw new ProviderQuotaError(delay / 1000);
        }
      }
      throw new ProviderQuotaError(60);
    } finally { release(); }
  };
}
