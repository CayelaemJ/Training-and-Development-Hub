/**
 * Minimal private Cloudflare R2 adapter for CABO staging.
 *
 * Deliberately NOT wired into live routes until tenant-scoped upload intents,
 * durable quota reservations, scan/quarantine and privacy review pass.
 * No paid SDK or background inference dependency.
 */
import { createHash, createHmac, randomUUID } from "node:crypto";

const BUCKET = "cabo-learning-staging-private";
const MAX_BYTES = 8 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PREFIXES = new Set(["quarantine", "approved", "temporary-exports"]);

export type R2Stage = "quarantine" | "approved" | "temporary-exports";
export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}
export function r2Configured(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CABO_R2_STORAGE_ENABLED === "true" &&
    env.CABO_R2_PRIVACY_REVIEW_APPROVED === "true" &&
    env.CABO_R2_QUOTA_ENFORCEMENT_READY === "true" &&
    Boolean(env.CABO_R2_ACCOUNT_ID && env.CABO_R2_ACCESS_KEY_ID &&
      env.CABO_R2_SECRET_ACCESS_KEY && env.CABO_R2_BUCKET === BUCKET);
}
export function r2Config(env: NodeJS.ProcessEnv = process.env): R2Config {
  if (!r2Configured(env)) throw new Error("CABO R2 staging is not approved or configured");
  const config = {
    accountId: env.CABO_R2_ACCOUNT_ID!,
    accessKeyId: env.CABO_R2_ACCESS_KEY_ID!,
    secretAccessKey: env.CABO_R2_SECRET_ACCESS_KEY!,
    bucket: env.CABO_R2_BUCKET!,
  };
  if (!/^[0-9a-f]{32}$/.test(config.accountId) ||
      !/^[a-zA-Z0-9]+$/.test(config.accessKeyId) ||
      !config.secretAccessKey.trim()) {
    throw new Error("Invalid R2 credential configuration");
  }
  return config;
}
export function newStagingKey(stage: R2Stage): string {
  if (!PREFIXES.has(stage)) throw new Error("Unrecognised R2 object category");
  return `${stage}/${randomUUID()}`;
}
export function validateStagingKey(key: string): void {
  const parts = key.split("/");
  if (parts.length !== 2 || !PREFIXES.has(parts[0]) || !UUID_RE.test(parts[1])) {
    throw new Error("Invalid CABO staging object key");
  }
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}
function encodeKey(key: string): string {
  validateStagingKey(key);
  return key.split("/").map(encodeURIComponent).join("/");
}
function signRequest(
  config: R2Config,
  method: "PUT" | "GET" | "HEAD" | "DELETE",
  key: string,
  body: Buffer | undefined,
  date: Date,
): { url: string; headers: Record<string, string> } {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucket}/${encodeKey(key)}`;
  const stamp = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = stamp.slice(0, 8);
  const payloadHash = sha256(body ?? Buffer.alloc(0));
  const canonicalHeaders =
    `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${stamp}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonical = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256(canonical)].join("\n");
  const kDate = hmac(`AWS4${config.secretAccessKey}`, day);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const signingKey = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign).digest("hex");
  return {
    url: `https://${host}${path}`,
    headers: {
      "x-amz-date": stamp,
      "x-amz-content-sha256": payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`,
    },
  };
}
function enforceLength(bytes: Buffer): void {
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new Error("CABO R2 pilot objects must be between 1 byte and 8 MiB");
  }
}
async function send(
  method: "PUT" | "GET" | "HEAD" | "DELETE",
  key: string,
  body?: Buffer,
): Promise<Response> {
  const config = r2Config();
  validateStagingKey(key);
  if (method === "PUT") {
    if (!body) throw new Error("Missing upload data");
    enforceLength(body);
  }
  const { url, headers } = signRequest(config, method, key, body, new Date());
  const response = await fetch(url, {
    method,
    headers,
    body: method === "PUT" ? new Uint8Array(body!) : undefined,
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok) {
    // Never log signed headers, object keys, provider response bodies or file contents.
    throw new Error(`CABO R2 ${method} request failed (${response.status})`);
  }
  return response;
}
/** Uploads must already have a tenant-authorised, reserved and scanned intent. */
export async function putR2StagingObject(key: string, bytes: Buffer): Promise<void> {
  // Never allow an uploader to bypass quarantine by choosing an approved key.
  validateStagingKey(key);
  if (!key.startsWith("quarantine/")) {
    throw new Error("Staging uploads must enter quarantine");
  }
  await send("PUT", key, bytes);
}
export async function getR2StagingObject(key: string): Promise<Buffer> {
  const response = await send("GET", key);
  const reported = response.headers.get("content-length");
  if (!reported || !/^\d+$/.test(reported) || Number(reported) > MAX_BYTES || Number(reported) < 1) {
    await response.body?.cancel();
    throw new Error("Invalid R2 response size");
  }
  if (!response.body) throw new Error("R2 response body missing");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      received += part.value.byteLength;
      if (received > MAX_BYTES || received > Number(reported)) {
        throw new Error("R2 download exceeds declared limit");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (received !== Number(reported)) throw new Error("R2 download size mismatch");
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), received);
}
export async function deleteR2StagingObject(key: string): Promise<void> {
  await send("DELETE", key);
}
export async function headR2StagingObject(key: string): Promise<number> {
  const response = await send("HEAD", key);
  const size = Number(response.headers.get("content-length"));
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES) {
    throw new Error("Invalid R2 object size");
  }
  return size;
}
