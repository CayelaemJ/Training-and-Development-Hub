/**
 * Cloudflare Django currently supports synthetic, isolated staging only.
 * Explicit authorisation AND a staging environment are required; production
 * stays dark even if ENABLE_CABO_DJANGO_INSIGHTS is accidentally switched on.
 *
 * This is a deployment gate, not verification that caller-provided metrics
 * are genuinely synthetic. Do not submit personal or live learner data.
 */
export function djangoInsightsStagingEnabled(env: Record<string, string | undefined>): boolean {
  return env.ENABLE_CABO_DJANGO_INSIGHTS === "true" &&
    (env.CABO_ENVIRONMENT === "staging" || env.CABO_ENVIRONMENT === "testing") &&
    env.CABO_DJANGO_STAGING_PRIVACY_APPROVED === "true";
}
