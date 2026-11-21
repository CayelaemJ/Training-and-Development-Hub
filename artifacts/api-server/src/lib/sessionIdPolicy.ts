/** Database session identifiers are generated as 32 cryptographically random bytes encoded in
 * lowercase hexadecimal. Reject malformed credentials before a session-store
 * lookup so arbitrary bearer strings cannot trigger needless DB work. */
const SESSION_ID_PATTERN = /^[a-f0-9]{64}$/;

export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

export function sessionIdFromCredentials(
  authorization: unknown,
  cookie: unknown,
): string | undefined {
  if (typeof authorization === "string" && /^Bearer(?:\s|$)/i.test(authorization)) {
    const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
    return match?.[1] && isSessionId(match[1]) ? match[1] : undefined;
  }
  return isSessionId(cookie) ? cookie : undefined;
}
