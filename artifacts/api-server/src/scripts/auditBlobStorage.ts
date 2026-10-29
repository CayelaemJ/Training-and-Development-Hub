/**
 * Explicit opt-in, read-only metadata audit. NEVER cleans/deletes anything.
 * Usage: CABO_BLOB_AUDIT_ENABLED=true pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/src/scripts/auditBlobStorage.ts
 *
 * Output is aggregate counts only: no learner/account/file/object identifiers.
 */
import { Bucket } from "@upstash/blob";
import { db, pool, studyMaterialsTable, uploadIntentsTable } from "@workspace/db";
import { like } from "drizzle-orm";
import {
  objectKeyFromStoredPath,
  PRIVATE_BLOB_PREFIX,
  summarizeBlobInventory,
  type BlobObjectMetadata,
} from "../lib/blobInventoryAudit";

const MAX_DB_ROWS = 5000;
const MAX_OBJECTS = 5000;
const CUTOFF_MINUTES = 15;

async function main(): Promise<void> {
  if (process.env.CABO_BLOB_AUDIT_ENABLED !== "true" ||
      !process.env.UPSTASH_BLOB_TOKEN?.trim()) {
    throw new Error("Read-only private Blob audit is not enabled");
  }
  const [materials, intents] = await Promise.all([
    db.select({objectPath:studyMaterialsTable.objectPath}).from(studyMaterialsTable)
      .where(like(studyMaterialsTable.objectPath,"/blob-uploads/%")).limit(MAX_DB_ROWS+1),
    db.select({objectPath:uploadIntentsTable.objectPath,createdAt:uploadIntentsTable.createdAt})
      .from(uploadIntentsTable).where(like(uploadIntentsTable.objectPath,"/blob-uploads/%"))
      .limit(MAX_DB_ROWS+1),
  ]);
  if (materials.length > MAX_DB_ROWS || intents.length > MAX_DB_ROWS) {
    throw new Error("Incomplete database inventory; increase bounded audit capacity before review");
  }
  const cutoff = Date.now() - CUTOFF_MINUTES * 60_000;
  const saved = new Set(materials.map(({objectPath}) => objectKeyFromStoredPath(objectPath)));
  const recent = new Set(intents.filter(({createdAt}) => createdAt.getTime() >= cutoff)
    .map(({objectPath}) => objectKeyFromStoredPath(objectPath)));
  // One page at a time, with a finite limit. Never collect entire bucket in memory.
  const bucket = new Bucket({token:process.env.UPSTASH_BLOB_TOKEN!,enableTelemetry:false});
  const objects: BlobObjectMetadata[]=[];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({prefix:PRIVATE_BLOB_PREFIX,limit:250,cursor});
    if (!Array.isArray(page.blobs)) throw new Error("Invalid private storage listing");
    if (objects.length+page.blobs.length>MAX_OBJECTS) throw new Error("Incomplete Blob inventory");
    objects.push(...page.blobs.map(o=>({path:o.path,size:o.size})));
    cursor=page.cursor;
  } while (cursor);

  const summary = summarizeBlobInventory(objects,saved,recent);
  // Stale intents may still refer to an object. The audit never deletes them.
  const staleIntents = intents.filter(({createdAt}) => createdAt.getTime() < cutoff).length;
  process.stdout.write(JSON.stringify({
    audit:"cabo-private-blob",version:1,mode:"read-only",
    ...summary,expiredUploadIntents:staleIntents,
    complete:true,
  })+"\n");
}

main().catch((error:unknown)=>{
  // Do not print exception objects: provider errors may contain signed URLs.
  process.stderr.write("CABO Blob audit aborted: "+(error instanceof Error?error.name:"Unknown")+"\n");
  process.exitCode=2;
}).finally(async () => { await pool.end().catch(() => undefined); });
