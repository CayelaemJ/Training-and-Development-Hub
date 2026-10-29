/**
 * Server-validated OpenID Connect authentication assurance.
 * Trust ONLY claims returned by oidc.authorizationCodeGrant() after ID token
 * verification. Never accept amr/auth_time from HTTP headers or client JSON.
 */
export type TrustedMfaEvidence = {
  mfaAt: number;
  source: "oidc";
};
const MAX_SKEW_SECONDS = 60;
export const ADMIN_MFA_MAX_AGE_SECONDS = 10 * 60;

export function trustedMfaFromOidcClaims(
  claims: Record<string, unknown>,
  nowSeconds = Math.floor(Date.now() / 1000),
): TrustedMfaEvidence | undefined {
  const methods = claims.amr;
  const authTime = claims.auth_time;
  if (!Array.isArray(methods) || !methods.every(x=>typeof x==="string") ||
      !methods.includes("mfa") ||
      typeof authTime !== "number" || !Number.isSafeInteger(authTime) ||
      authTime > nowSeconds + MAX_SKEW_SECONDS || authTime <= 0) {
    return undefined;
  }
  // The validated token authenticates the claims. This helper intentionally
  // refuses to infer MFA from pwd, sms, email OTP, or unapproved acr strings.
  return { mfaAt: authTime, source: "oidc" };
}

export function isRecentVerifiedMfa(
  evidence: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!evidence || typeof evidence !== "object") return false;
  const e=evidence as Partial<TrustedMfaEvidence>;
  return e.source==="oidc" && typeof e.mfaAt==="number" &&
    Number.isSafeInteger(e.mfaAt) &&
    e.mfaAt > 0 && e.mfaAt <= nowSeconds + MAX_SKEW_SECONDS &&
    nowSeconds-e.mfaAt <= ADMIN_MFA_MAX_AGE_SECONDS;
}
export const privilegedPortalRoles = new Set<string>([
  "superadmin","national_director","provincial_director","district_director",
  "group_executive","governing_body_chair","headmaster","deputy_headmaster",
  "department_head","grade_head","administrator",
]);
export function isPrivilegedMutation(method: string, url: string): boolean {
  const path = url.split("?",1)[0];
  if (!path.startsWith("/api/")) return false;
  // Signing in/out and obtaining a new code must remain possible when MFA
  // is stale; everything else privileged is subject to new step-up.
  if (/^\/api\/(?:login|logout|callback|test-login|test-logout|native\/(?:token|authorize|logout|test-login))\/?$/.test(path)) return false;
  return ["POST","PATCH","PUT","DELETE"].includes(method) ||
    path.startsWith("/api/platform/");
}
