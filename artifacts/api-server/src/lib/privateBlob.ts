import { Bucket, BlobError } from "@upstash/blob";
import { randomUUID } from "node:crypto";

export const MAX_BLOB_FILE_BYTES = 8 * 1024 * 1024;
const BLOB_PREFIX = "/blob-uploads/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function blobUploadStatus(env: NodeJS.ProcessEnv = process.env): "disabled" | "invalid" | "enabled" {
  if (env.CABO_BLOB_UPLOADS_ENABLED !== "true") return "disabled";
  // Explicit privacy review gate: the storage service can replicate internationally.
  if (env.CABO_BLOB_PRIVACY_REVIEW_APPROVED !== "true" || !env.UPSTASH_BLOB_TOKEN?.trim()) {
    return "invalid";
  }
  return "enabled";
}

export function newBlobObjectPath(): string {
  return BLOB_PREFIX + randomUUID();
}
export function isBlobObjectPath(value: string): boolean {
  return value.startsWith(BLOB_PREFIX) && UUID.test(value.slice(BLOB_PREFIX.length));
}
export function blobKeyForPath(value: string): string {
  if (!isBlobObjectPath(value)) throw new Error("Invalid private document path");
  // The key contains no filename, user name, personal identifier or school name.
  return "private/materials/" + value.slice(BLOB_PREFIX.length);
}
function bucket(): Bucket {
  const token = process.env.UPSTASH_BLOB_TOKEN;
  if (!token?.trim()) throw new Error("Private blob storage is unavailable");
  return new Bucket({ token, cache: "no-store", enableTelemetry: false });
}
export function isBlobMissing(error: unknown): boolean {
  return BlobError.is(error) && error.code === "not_found";
}
export async function savePrivateBlob(path: string, data: Buffer, contentType: string): Promise<void> {
  if (data.length < 1 || data.length > MAX_BLOB_FILE_BYTES) throw new Error("Document exceeds private storage limit");
  const client = bucket();
  const key = blobKeyForPath(path);
  await client.put(key, data, {
    contentType, maxSize: MAX_BLOB_FILE_BYTES, cache: "no-store",
    allowOverwrite: false, metadata: { kind: "study-material" },
  });
  // The write is not considered complete until storage confirms the byte size.
  const stored = await client.info(key);
  if (stored.size !== data.length) throw new Error("Document size verification failed");
}
export async function loadPrivateBlob(path: string): Promise<Buffer> {
  const client = bucket();
  const key = blobKeyForPath(path);
  const info = await client.info(key);
  if (info.size < 1 || info.size > MAX_BLOB_FILE_BYTES) throw new Error("Private document size is invalid");
  const result = await client.get(key);
  const bytes = Buffer.from(await new Response(result.body).arrayBuffer());
  if (bytes.length !== info.size) throw new Error("Private document byte length mismatch");
  return bytes;
}
export async function deletePrivateBlob(path: string): Promise<void> {
  await bucket().del(blobKeyForPath(path));
}
export async function privateBlobDownload(path: string, filename: string): Promise<{ url: string; expiresAt: Date }> {
  const safeFilename = filename.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "learning-material";
  const result = await bucket().signedReadUrl(blobKeyForPath(path), {
    expiresIn: "1m", downloadAs: safeFilename,
  });
  return { url: result.url, expiresAt: result.expiresAt };
}
