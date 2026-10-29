/**
 * Pure, read-only reconciliation for private CABO learning materials.
 * Never include object keys, filenames, schools or account identifiers in output.
 */
export type BlobObjectMetadata = { path: string; size: number };
export type BlobAuditCounts = {
  scannedObjects: number;
  scannedBytes: number;
  referencedMaterialObjects: number;
  pendingUploadObjects: number;
  unreferencedObjects: number;
  unreferencedBytes: number;
  recordedMaterialsWithoutObject: number;
  outstandingIntentsWithoutObject: number;
};

export const PRIVATE_BLOB_PREFIX = "private/materials/";

export function summarizeBlobInventory(
  objects: readonly BlobObjectMetadata[],
  savedPaths: ReadonlySet<string>,
  unexpiredIntentPaths: ReadonlySet<string>,
): BlobAuditCounts {
  const keys = new Set<string>();
  let scannedBytes = 0;
  let referencedMaterialObjects = 0;
  let pendingUploadObjects = 0;
  let unreferencedObjects = 0;
  let unreferencedBytes = 0;
  for (const object of objects) {
    if (!object.path.startsWith(PRIVATE_BLOB_PREFIX) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(object.path.slice(PRIVATE_BLOB_PREFIX.length))) {
      throw new Error("Unexpected private storage key; aborting reconciliation");
    }
    if (!Number.isSafeInteger(object.size) || object.size < 0 || keys.has(object.path)) {
      throw new Error("Invalid or duplicate object metadata");
    }
    keys.add(object.path);
    scannedBytes += object.size;
    if (savedPaths.has(object.path)) referencedMaterialObjects++;
    else if (unexpiredIntentPaths.has(object.path)) pendingUploadObjects++;
    else {
      unreferencedObjects++;
      unreferencedBytes += object.size;
    }
  }
  return {
    scannedObjects: keys.size,
    scannedBytes,
    referencedMaterialObjects,
    pendingUploadObjects,
    unreferencedObjects,
    unreferencedBytes,
    recordedMaterialsWithoutObject: [...savedPaths].filter(key => !keys.has(key)).length,
    outstandingIntentsWithoutObject: [...unexpiredIntentPaths].filter(key => !keys.has(key)).length,
  };
}

/** Database application paths are never reused as remote URLs. */
export function objectKeyFromStoredPath(path: string): string {
  if (!/^\/blob-uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(path)) {
    throw new Error("Unexpected database object path");
  }
  return PRIVATE_BLOB_PREFIX + path.slice("/blob-uploads/".length);
}
