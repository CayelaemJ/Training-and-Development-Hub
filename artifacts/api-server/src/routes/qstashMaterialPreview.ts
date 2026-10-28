import { Router, type IRouter, type Request } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { pool, db, studyMaterialsTable, materialUploadBlobsTable } from "@workspace/db";
import { cachedMaterial, materialReadingEnabled, saveMaterialText } from "../lib/materialCache";
import { readObjectBuffer, extractMaterialText } from "../lib/materialText";
import { MaterialReadError } from "../lib/uploadPolicy";
import { ObjectStorageService } from "../lib/objectStorage";
import { publishPreviewJob, qstashConfigured, verifyQstashCallback } from "../lib/qstashMaterialPreview";

const router: IRouter = Router();
const idSchema = z.coerce.number().int().positive().max(2_147_483_647);
const callbackBodySchema = z.object({ version: z.literal(1), materialId: idSchema }).strict();
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const storage = new ObjectStorageService();

function available(): boolean {
  return materialReadingEnabled() && qstashConfigured();
}

/** Authenticated, consent-only scheduling. Existing preview API remains unchanged. */
router.post("/materials/:id/preview-jobs", async (req, res) => {
  if (!req.isAuthenticated()) { res.sendStatus(401); return; }
  if (!available()) { res.status(503).json({error:"Background preview is not enabled."}); return; }
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) { res.sendStatus(400); return; }
  const [material] = await db.select({
    id:studyMaterialsTable.id,userId:studyMaterialsTable.userId,
    sizeBytes:studyMaterialsTable.sizeBytes,
  }).from(studyMaterialsTable).where(and(
    eq(studyMaterialsTable.id,id.data),eq(studyMaterialsTable.userId,req.user.id),
  )).limit(1);
  if (!material) { res.sendStatus(404); return; }
  if (material.sizeBytes > MAX_PREVIEW_BYTES) {
    res.status(422).json({error:"Background preview supports documents up to 2 MB. Open this file normally instead."});
    return;
  }
  const cached = await cachedMaterial(material.id,req.user.id);
  if (!cached.allowAiReading) {
    res.status(403).json({error:"Explicit document reading consent is required."});
    return;
  }
  if (cached.text) {
    res.setHeader("Cache-Control","private, no-store");
    res.json({status:"ready",materialId:material.id}); return;
  }
  try {
    await publishPreviewJob({version:1,materialId:material.id});
    res.setHeader("Cache-Control","private, no-store");
    res.status(202).json({status:"queued",materialId:material.id});
  } catch {
    res.status(503).json({error:"Background preview queue is unavailable. Open the document normally."});
  }
});

/**
 * Webhook is public by necessity, but never processes unverified bodies.
 * A Postgres advisory lock plus existing cached text make delivery idempotent.
 * Retries are safe and no subject or document content is stored in QStash.
 */
router.post("/internal/qstash/material-preview", async (req: Request, res) => {
  if (!available()) { res.sendStatus(404); return; }
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody || rawBody.length < 1 || rawBody.length > 1024 ||
      !verifyQstashCallback(req.get("Upstash-Signature"),rawBody)) {
    res.status(401).json({error:"Unverified callback"}); return;
  }
  const decoded = callbackBodySchema.safeParse(req.body);
  if (!decoded.success) { res.sendStatus(400); return; }
  const materialId = decoded.data.materialId;
  let connection: Awaited<ReturnType<typeof pool.connect>> | undefined;
  let locked = false;
  try {
    connection = await pool.connect();
    const claim = await connection.query<{ acquired:boolean }>(
      "SELECT pg_try_advisory_lock($1::integer,$2::integer) AS acquired",
      [367911,materialId],
    );
    locked = claim.rows[0]?.acquired === true;
    if (!locked) { res.status(503).json({error:"Preview processing is busy"}); return; }

    const [material] = await db.select({
      id:studyMaterialsTable.id,userId:studyMaterialsTable.userId,
      objectPath:studyMaterialsTable.objectPath,fileName:studyMaterialsTable.fileName,
      sizeBytes:studyMaterialsTable.sizeBytes,
    }).from(studyMaterialsTable).where(eq(studyMaterialsTable.id,materialId)).limit(1);
    if (!material || material.sizeBytes > MAX_PREVIEW_BYTES) { res.sendStatus(204); return; }
    const cached = await cachedMaterial(material.id,material.userId);
    // Consent may have been revoked since scheduling: never process it.
    if (!cached.allowAiReading || cached.text) { res.sendStatus(204); return; }

    const legacy = material.objectPath.startsWith("/railway-uploads/");
    const [existing] = legacy ? await db.select({bytes:materialUploadBlobsTable.bytes})
      .from(materialUploadBlobsTable)
      .where(and(eq(materialUploadBlobsTable.objectPath,material.objectPath),
                 eq(materialUploadBlobsTable.userId,material.userId))).limit(1) : [];
    const bytes = legacy ? existing?.bytes : await readObjectBuffer(
      (await storage.getObjectEntityFile(material.objectPath)).createReadStream(),
    );
    if (!bytes) { res.status(503).json({error:"Document storage temporarily unavailable"}); return; }
    if (bytes.length !== material.sizeBytes) {
      res.status(503).json({error:"Document bytes do not match expected size"}); return;
    }
    // No AI/OCR is invoked from the callback; no external model receives the document.
    const text = await extractMaterialText(material.fileName,bytes,{allowAiReading:false});
    if (text.length < 30) { res.sendStatus(204); return; }

    // Recheck consent immediately before writing: a guardian/user may revoke it mid-job.
    const latest = await cachedMaterial(material.id,material.userId);
    if (!latest.allowAiReading) { res.sendStatus(204); return; }
    if (!latest.text) await saveMaterialText(material.id,material.userId,text);
    res.sendStatus(204);
  } catch (error) {
    if (error instanceof MaterialReadError) {
      // Scanned/unsupported content requires a separately approved OCR flow.
      res.sendStatus(204); return;
    }
    req.log?.warn({materialId,errorType:error instanceof Error?error.name:"Unknown"},"Background preview retry requested");
    res.status(503).json({error:"Preview retry required"});
  } finally {
    if (connection) {
      if (locked) await connection.query("SELECT pg_advisory_unlock($1::integer,$2::integer)",[367911,materialId])
        .catch(() => undefined);
      connection.release();
    }
  }
});
export default router;
