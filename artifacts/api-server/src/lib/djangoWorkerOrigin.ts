/**
 * Exact-origin allowlist for CABO's isolated Cloudflare Django staging service.
 * A deployment credential must never be sent to an attacker-controlled host.
 */
const STAGING_HOST = "cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev";

/** Returns an approved URL or fails closed on redirects, userinfo and origins. */
export function djangoWorkerDraftURL(rawUrl: string): URL {
  const base = new URL(rawUrl);
  if (base.protocol !== "https:" ||
      base.hostname !== STAGING_HOST ||
      base.port !== "" ||
      base.username !== "" ||
      base.password !== "" ||
      base.search !== "" ||
      base.hash !== "" ||
      base.pathname !== "/") {
    throw Error("Unapproved Django worker origin");
  }
  return new URL("/v1/insights/draft", base);
}
