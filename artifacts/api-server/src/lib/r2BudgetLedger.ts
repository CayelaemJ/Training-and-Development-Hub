/**
 * PostgreSQL-backed staging upload reservations. NOT exposed to application routes
 * until tenant membership, scanning, and privacy release gates are implemented.
 * Both monthly operation limits and storage allocations are transactionally enforced.
 */
import { pool } from "@workspace/db";
import { newStagingKey, r2Configured, validateStagingKey } from "./r2Staging";

async function acquireClient() { return await pool.connect(); }
type Client = Awaited<ReturnType<typeof acquireClient>>;
const CAPACITY = 2 * 1024 * 1024 * 1024;
const USER_CAP = 48 * 1024 * 1024;
const MAX_FILE = 8 * 1024 * 1024;

export class R2LedgerError extends Error {
  constructor(readonly reason: "DISABLED" | "INVALID" | "LIMIT" | "NOT_FOUND" | "CONFLICT") {
    super("R2 staging storage is unavailable");
    this.name = "R2LedgerError";
  }
}
function guard() {
  if (!r2Configured() || process.env.CABO_ENVIRONMENT !== "staging") {
    throw new R2LedgerError("DISABLED");
  }
}
function identity(userId: string, tenantId: string) {
  if (!userId || userId.length > 128 || !tenantId ||
      tenantId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
    throw new R2LedgerError("INVALID");
  }
}
async function tx<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = await acquireClient();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve original error */ }
    throw error;
  } finally {
    client.release();
  }
}
async function lockBudget(client: Client) {
  const r = await client.query<{reserved_bytes:string;stored_bytes:string}>(
    "SELECT reserved_bytes,stored_bytes FROM cabo_r2_usage WHERE singleton=true FOR UPDATE",
  );
  if (r.rowCount !== 1) throw new R2LedgerError("DISABLED");
  return {reserved:Number(r.rows[0].reserved_bytes),stored:Number(r.rows[0].stored_bytes)};
}
async function countOp(client: Client, type: "write_operations" | "read_operations") {
  const cap = type === "write_operations" ? 10_000 : 50_000;
  const r = await client.query(
    `INSERT INTO cabo_r2_monthly_operations(month_utc,${type})
     VALUES (date_trunc('month',timezone('utc',now()))::date,1)
     ON CONFLICT(month_utc) DO UPDATE
     SET ${type}=cabo_r2_monthly_operations.${type}+1,updated_at=now()
     WHERE cabo_r2_monthly_operations.${type} < $1
     RETURNING ${type}`,[cap],
  );
  if (r.rowCount !== 1) throw new R2LedgerError("LIMIT");
}
export type R2UploadReservation = {
  /** Must be sourced from verified server-side user+institution membership. */
  userId: string;
  tenantId: string;
  fileName: string;
  mediaType: string;
  size: number;
  sha256: string;
  aiConsent?: boolean;
};
/** Reserves bytes and one write op atomically, before any upload. */
export async function reserveR2Upload(input: R2UploadReservation): Promise<string> {
  guard();
  identity(input.userId,input.tenantId);
  if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > MAX_FILE ||
      !input.fileName || input.fileName.length > 512 ||
      !input.mediaType || input.mediaType.length > 255 ||
      !/^[a-f0-9]{64}$/.test(input.sha256)) throw new R2LedgerError("INVALID");
  const key = newStagingKey("quarantine");
  return tx(async client => {
    const budget = await lockBudget(client);
    if (budget.stored+budget.reserved+input.size > CAPACITY) throw new R2LedgerError("LIMIT");
    const perUser = await client.query<{bytes:string}>(
      `SELECT COALESCE(SUM(size_bytes),0)::text AS bytes FROM cabo_r2_objects
       WHERE owner_user_id=$1 AND state <> 'deleted'`,[input.userId],
    );
    if (Number(perUser.rows[0].bytes)+input.size > USER_CAP) throw new R2LedgerError("LIMIT");
    await countOp(client,"write_operations");
    await client.query(
      `INSERT INTO cabo_r2_objects
       (object_key,owner_user_id,tenant_id,file_name,media_type,expected_sha256,size_bytes,ai_read_consent)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [key,input.userId,input.tenantId,input.fileName,input.mediaType,input.sha256,input.size,input.aiConsent===true],
    );
    await client.query(
      "UPDATE cabo_r2_usage SET reserved_bytes=reserved_bytes+$1,updated_at=now() WHERE singleton=true",
      [input.size],
    );
    return key;
  });
}
/**
 * Only the trusted upload/scan coordinator may call after independently
 * verifying the R2 object byte count and cryptographic hash.
 */
export async function confirmR2Quarantine(
  key:string,userId:string,tenantId:string,actualSize:number,actualSha256:string,
):Promise<void> {
  guard();validateStagingKey(key);identity(userId,tenantId);
  await tx(async client=>{
    await lockBudget(client);
    const r=await client.query<{size_bytes:number;expected_sha256:string}>(
      `SELECT size_bytes,expected_sha256 FROM cabo_r2_objects
       WHERE object_key=$1 AND owner_user_id=$2 AND tenant_id=$3
       AND state='reserved' AND expires_at>now() FOR UPDATE`,
      [key,userId,tenantId],
    );
    if(r.rowCount!==1)throw new R2LedgerError("NOT_FOUND");
    if(r.rows[0].size_bytes!==actualSize || r.rows[0].expected_sha256!==actualSha256){
      throw new R2LedgerError("CONFLICT");
    }
    await client.query(
      "UPDATE cabo_r2_objects SET state='quarantined',billing_stage='stored',updated_at=now() WHERE object_key=$1",[key],
    );
    await client.query(
      `UPDATE cabo_r2_usage SET reserved_bytes=reserved_bytes-$1,
       stored_bytes=stored_bytes+$1,updated_at=now() WHERE singleton=true`,[actualSize],
    );
  });
}
/** No read unless a separate trusted scanner has explicitly approved the object. */
export async function reserveR2Read(key:string,userId:string,tenantId:string):Promise<void> {
  guard();validateStagingKey(key);identity(userId,tenantId);
  await tx(async client=>{
    await lockBudget(client);
    const r=await client.query(
      `SELECT 1 FROM cabo_r2_objects WHERE object_key=$1
       AND owner_user_id=$2 AND tenant_id=$3 AND state='approved'
       AND deleted_at IS NULL`,[key,userId,tenantId],
    );
    if(r.rowCount!==1)throw new R2LedgerError("NOT_FOUND");
    await countOp(client,"read_operations");
  });
}
/** Revokes access immediately; retry remote deletion until R2 absence is confirmed. */
export async function tombstoneR2Upload(key:string,userId:string,tenantId:string):Promise<void> {
  guard();validateStagingKey(key);identity(userId,tenantId);
  await tx(async client=>{
    await lockBudget(client);
    const r=await client.query(
      `UPDATE cabo_r2_objects SET state='deleting',deleted_at=now(),updated_at=now()
       WHERE object_key=$1 AND owner_user_id=$2 AND tenant_id=$3
       AND state IN('reserved','quarantined','approved','deleting') RETURNING object_key`,
      [key,userId,tenantId],
    );
    if(r.rowCount!==1)throw new R2LedgerError("NOT_FOUND");
  });
}
/** Caller must have verified R2 DELETE success and subsequent HEAD 404. */
export async function confirmR2Deletion(key:string):Promise<void> {
  guard();validateStagingKey(key);
  await tx(async client=>{
    await lockBudget(client);
    const r=await client.query<{size_bytes:number;billing_stage:"reserved"|"stored"}>(
      "SELECT size_bytes,billing_stage FROM cabo_r2_objects WHERE object_key=$1 AND state='deleting' FOR UPDATE",[key],
    );
    if(r.rowCount!==1)throw new R2LedgerError("NOT_FOUND");
    const counter=r.rows[0].billing_stage==="stored"?"stored_bytes":"reserved_bytes";
    await client.query(
      `UPDATE cabo_r2_usage SET ${counter}=${counter}-$1,updated_at=now() WHERE singleton=true`,
      [r.rows[0].size_bytes],
    );
    await client.query(
      "UPDATE cabo_r2_objects SET state='deleted',updated_at=now() WHERE object_key=$1",[key],
    );
  });
}
