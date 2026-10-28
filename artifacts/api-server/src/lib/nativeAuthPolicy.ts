import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Native callback targets are strictly pinned. The Windows pilot uses a fixed
// loopback port bound before the browser opens; validate on Windows before release.
export const NATIVE_CLIENTS = {
  "cabo-android": "cabo-learninghub-android://auth",
  "cabo-ios": "cabo-learninghub-ios://auth",
  // Fixed loopback callback for unpackaged Windows WinUI 3 pilot.
  "cabo-windows": "http://127.0.0.1:47787/auth",
} as const;
export type NativeClientId = keyof typeof NATIVE_CLIENTS;
export const NATIVE_CODE_SECONDS = 180;
export const NATIVE_SESSION_SECONDS = 3600;

export function nativeAuthEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.CABO_NATIVE_AUTH_ENABLED === "true";
}
export function nativeRedirect(clientId: unknown): string | null {
  if (typeof clientId !== "string" || !Object.hasOwn(NATIVE_CLIENTS, clientId)) return null;
  return NATIVE_CLIENTS[clientId as NativeClientId];
}
export function validPkceChallenge(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
export function validPkceVerifier(value: unknown): value is string {
  return typeof value === "string" && value.length >= 43 && value.length <= 128 && /^[A-Za-z0-9._~-]+$/.test(value);
}
export function validState(value: unknown): value is string {
  return typeof value === "string" && value.length >= 32 && value.length <= 128 && /^[A-Za-z0-9._~-]+$/.test(value);
}
export function randomNativeCode(): string {
  return randomBytes(32).toString("base64url");
}
export function codeDigest(rawCode: string): string {
  return createHash("sha256").update(rawCode, "utf8").digest("hex");
}
export function verifyPkce(verifier: unknown, expectedChallenge: string): boolean {
  if (!validPkceVerifier(verifier) || !validPkceChallenge(expectedChallenge)) return false;
  const actual = createHash("sha256").update(verifier, "utf8").digest("base64url");
  return timingSafeEqual(Buffer.from(actual, "ascii"), Buffer.from(expectedChallenge, "ascii"));
}
export function validCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
