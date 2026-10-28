import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const CALLBACK_PATH = "/api/internal/qstash/material-preview";
const QSTASH_API = "https://qstash-eu-central-1.upstash.io";
export type PreviewJobPayload = { version: 1; materialId: number };

function callbackUrl(env: NodeJS.ProcessEnv): string {
  const raw = env.QSTASH_MATERIAL_PREVIEW_URL?.trim();
  if (!raw) throw new Error("QStash callback URL not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      url.search || url.pathname !== CALLBACK_PATH) {
    throw new Error("QStash callback URL must be a fixed HTTPS application endpoint");
  }
  return url.toString();
}
function signatureKey(env: NodeJS.ProcessEnv): [string, string] {
  const current = env.QSTASH_CURRENT_SIGNING_KEY?.trim() || "";
  const next = env.QSTASH_NEXT_SIGNING_KEY?.trim() || "";
  if (!current || !next) throw new Error("QStash signing keys missing");
  return [current, next];
}
export function qstashConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ENABLE_QSTASH_MATERIAL_PREVIEW !== "true") return false;
  try {
    callbackUrl(env);
    signatureKey(env);
    if (!env.QSTASH_TOKEN?.trim()) return false;
    return true;
  } catch { return false; }
}

/** Validates JWT HMAC and Upstash's signed URL, issuer, time, and raw-body digest. */
export function verifyQstashCallback(
  signature: string | undefined,
  rawBody: Buffer,
  env: NodeJS.ProcessEnv = process.env,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  try {
    if (!signature || signature.length > 4096 || rawBody.length > 1024) return false;
    const [header, payload, provided, ...extra] = signature.split(".");
    if (extra.length || !header || !payload || !provided) return false;
    const head = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as { alg?: string; typ?: string };
    if (head.alg !== "HS256" || (head.typ && head.typ !== "JWT")) return false;
    const supplied = Buffer.from(provided, "base64url");
    if (supplied.length !== 32) return false;
    const keys = signatureKey(env);
    const authenticated = keys.some(key => {
      const expected = createHmac("sha256", key).update(header + "." + payload).digest();
      return timingSafeEqual(supplied, expected);
    });
    if (!authenticated) return false;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      iss?: string; sub?: string; exp?: number; nbf?: number; iat?: number; body?: string;
    };
    if (claims.iss !== "Upstash" || claims.sub !== callbackUrl(env)) return false;
    if (!Number.isInteger(claims.exp) || !Number.isInteger(claims.nbf) ||
        claims.nbf! > nowSeconds + 5 || claims.exp! <= nowSeconds - 5 ||
        claims.exp! - claims.nbf! > 600) return false;
    if (claims.iat !== undefined && (!Number.isInteger(claims.iat) || claims.iat > nowSeconds + 5)) return false;
    const expectedBodyHash = createHash("sha256").update(rawBody).digest("base64url");
    if (typeof claims.body !== "string") return false;
    const suppliedBodyHash = claims.body.replace(/=+$/, "");
    const digest1 = Buffer.from(suppliedBodyHash);
    const digest2 = Buffer.from(expectedBodyHash);
    return digest1.length === digest2.length && timingSafeEqual(digest1, digest2);
  } catch {
    return false;
  }
}

export async function publishPreviewJob(
  payload: PreviewJobPayload,
  fetcher: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!qstashConfigured(env) || !Number.isSafeInteger(payload.materialId) || payload.materialId < 1) {
    throw new Error("QStash background material preview is not available");
  }
  // No user ID, learner content, personal data, or document text enters the queue.
  const target = callbackUrl(env);
  const result = await fetcher(QSTASH_API + "/v2/publish/" + target, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.QSTASH_TOKEN!.trim(),
      "Content-Type": "application/json",
      "Upstash-Retries": "2",
      "Upstash-Deduplication-Id": "cabo-preview-" + payload.materialId,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(2500),
  });
  if (!result.ok) throw new Error("Unable to queue material preview");
}
