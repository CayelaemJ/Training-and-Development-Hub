import { trustedOrigins } from "./originPolicy";

/**
 * The callback is an identity-provider redirect, so never derive it from
 * X-Forwarded-Host or X-Forwarded-Proto supplied on the incoming request.
 * An actual approved deployment origin must match the request Host header.
 */
export function oidcRequestOrigin(host: string | undefined, env: NodeJS.ProcessEnv): string | null {
  if (!host || !/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(host)) return null;
  const approved = trustedOrigins(env);
  if (env.NODE_ENV !== "production") {
    const port = env.PORT || "3000";
    if (/^[0-9]{1,5}$/.test(port) && Number(port) > 0 && Number(port) <= 65535) {
      approved.add("http://localhost:" + port);
      approved.add("http://127.0.0.1:" + port);
    }
  }
  for (const origin of approved) {
    if (new URL(origin).host.toLowerCase() === host.toLowerCase()) return origin;
  }
  return null;
}

/** Accept only same-site absolute paths; backslashes also act as slashes in URLs. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/.test(value) || /%(?:2f|5c|0d|0a)/i.test(value)) return "/";
  try {
    const base = "https://auth-boundary.invalid";
    const parsed = new URL(value, base);
    return parsed.origin === base ? value : "/";
  } catch { return "/"; }
}
