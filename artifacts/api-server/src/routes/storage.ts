import { Readable } from 'stream';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { materialReadingEnabled } from '../lib/materialCache';
import { and,eq,sql,gte } from 'drizzle-orm';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { db, uploadIntentsTable, materialUploadBlobsTable, studyMaterialsTable } from '@workspace/db';
import { Router, type IRouter, type Request, type Response } from 'express';

import { ObjectPermission } from '../lib/objectAcl';
import { validateMaterial, validateDeclaredMaterialType, MaterialReadError, MAX_FILE_BYTES } from '../lib/uploadPolicy';
import { railwayUploadUrl } from '../lib/railwayUploadUrl';
import { oidcRequestOrigin } from '../lib/originPolicy';
import { validateMaterialSignature } from '../lib/uploadPolicy';
import {
  blobUploadStatus, MAX_BLOB_FILE_BYTES, newBlobObjectPath, savePrivateBlob,
  privateBlobDownload, isBlobMissing, isBlobObjectPath,
} from '../lib/privateBlob';
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_BLOB_USER_BYTES = 48 * 1024 * 1024;
const MAX_BLOB_RECORDED_BYTES = 512 * 1024 * 1024;
/** Budget on persisted and recent pending uploads; storage provider enforces its free cap. */
async function withinBlobBudget(userId:string,additional:number):Promise<boolean>{
  const activeSince = new Date(Date.now() - 15 * 60_000);
  const [userMaterials,userIntents,allMaterials,allIntents] = await Promise.all([
    db.select({bytes:sql<string>`COALESCE(SUM(${studyMaterialsTable.sizeBytes}),0)::text`})
      .from(studyMaterialsTable).where(eq(studyMaterialsTable.userId,userId)),
    db.select({bytes:sql<string>`COALESCE(SUM(${uploadIntentsTable.sizeBytes}),0)::text`,items:sql<string>`COUNT(*)::text`})
      .from(uploadIntentsTable).where(and(eq(uploadIntentsTable.userId,userId),gte(uploadIntentsTable.createdAt,activeSince))),
    db.select({bytes:sql<string>`COALESCE(SUM(${studyMaterialsTable.sizeBytes}),0)::text`}).from(studyMaterialsTable),
    db.select({bytes:sql<string>`COALESCE(SUM(${uploadIntentsTable.sizeBytes}),0)::text`})
      .from(uploadIntentsTable).where(gte(uploadIntentsTable.createdAt,activeSince)),
  ]);
  const owned = Number(userMaterials[0]?.bytes||0)+Number(userIntents[0]?.bytes||0);
  const overall = Number(allMaterials[0]?.bytes||0)+Number(allIntents[0]?.bytes||0);
  return Number(userIntents[0]?.items||0)<5 &&
    owned+additional<=MAX_BLOB_USER_BYTES && overall+additional<=MAX_BLOB_RECORDED_BYTES;
}


function hasAuthenticatedSession(
  req: Request,
): req is Request & {
  isAuthenticated: () => boolean;
  user: NonNullable<Request['user']>;
} {
  if (
    !('isAuthenticated' in req) ||
    typeof req.isAuthenticated !== 'function'
  ) {
    return false;
  }

  return req.isAuthenticated();
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Requires auth middleware so public callers cannot mint write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response) => {
    if (!hasAuthenticatedSession(req)) {
      res.status(401).json({ error: 'Unauthorized' });

      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      validateMaterial(name, size);
      validateDeclaredMaterialType(name, contentType);
      const allowAiReading = req.body.allowAiReading === true;
      const blobStatus = blobUploadStatus();
      if (blobStatus === 'invalid') {
        res.status(503).json({error:'Private document storage is not approved or configured.'}); return;
      }
      const railwayFallback = (process.env.CABO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME) === 'testing';
      const host = req.get('host');
      const origin = blobStatus === 'enabled' ? oidcRequestOrigin(host,process.env) : null;
      if (blobStatus === 'enabled' && !origin) {
        res.status(400).json({error:'Upload origin not approved.'}); return;
      }
      if (blobStatus === 'enabled' && size > MAX_BLOB_FILE_BYTES) {
        res.status(413).json({error:'Private uploads are limited to 8 MB during the pilot.'}); return;
      }
      if (blobStatus === 'enabled' && !(await withinBlobBudget(req.user.id,size))) {
        res.status(429).json({error:'Private document storage allowance is reached. Finish or remove existing uploads.'}); return;
      }
      const objectPath = blobStatus === 'enabled' ? newBlobObjectPath() :
        railwayFallback ? '/railway-uploads/' + randomUUID() : '';
      if (blobStatus === 'disabled' && railwayFallback && (!host || !/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host))) {
        res.status(400).json({error:'Invalid upload host'}); return;
      }
      const uploadURL = blobStatus === 'enabled'
        ? origin + '/api/storage/uploads/blob/' + objectPath.split('/').pop()
        : railwayFallback ? railwayUploadUrl(host!, objectPath)
        : await objectStorageService.getObjectEntityUploadURL();
      const finalObjectPath = blobStatus === 'enabled' || railwayFallback
        ? objectPath : objectStorageService.normalizeObjectEntityPath(uploadURL);
      await db.insert(uploadIntentsTable).values({
        objectPath: finalObjectPath,
        userId: req.user.id,
        fileName: name,
        contentType,
        sizeBytes: size,
      });

      if(materialReadingEnabled())await db.execute(sql`UPDATE upload_intents SET allow_ai_reading=${allowAiReading} WHERE object_path=${finalObjectPath} AND user_id=${req.user.id}`);
      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath: finalObjectPath,
        }),
      );
    } catch (error) {
      if(error instanceof MaterialReadError){res.status(400).json({error:error.message});return;}
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * Private, same-origin, short-lived upload destination for Railway TESTING only.
 * Binary bytes stay in the isolated PostgreSQL database until material creation.
 * This avoids Replit's unavailable localhost object-storage sidecar on Railway.
 */
router.put('/storage/uploads/railway/:id',express.raw({type:'*/*',limit:MAX_FILE_BYTES}),async(req,res)=>{
 if(!hasAuthenticatedSession(req)){res.status(401).json({error:'Unauthorized'});return}
 if((process.env.CABO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME)!=='testing'){res.sendStatus(404);return}
 const identifier=req.params.id;
 if(typeof identifier!=='string'||!/^[a-f0-9-]{36}$/.test(identifier)){res.sendStatus(400);return}
 const objectPath='/railway-uploads/'+identifier;
 const [intent]=await db.select().from(uploadIntentsTable).where(and(eq(uploadIntentsTable.objectPath,objectPath),eq(uploadIntentsTable.userId,req.user.id))).limit(1);
 if(!intent){res.sendStatus(404);return}
 const bytes=Buffer.isBuffer(req.body)?req.body:Buffer.alloc(0);
 if(!bytes.length||bytes.length!==intent.sizeBytes){res.status(400).json({error:'Upload size mismatch'});return}
 if(Date.now()-intent.createdAt.getTime()>15*60_000){res.status(410).json({error:'Upload expired; request a new URL'});return}
 await db.insert(materialUploadBlobsTable).values({objectPath,userId:req.user.id,bytes}).onConflictDoNothing();
 res.sendStatus(204);
});

/**
 * Authenticated same-origin upload for the existing client PUT contract.
 * The app verifies intent, bytes, format and ownership before private storage.
 */
router.put('/storage/uploads/blob/:id',express.raw({type:'*/*',limit:MAX_BLOB_FILE_BYTES}),async(req,res)=>{
  if (!hasAuthenticatedSession(req)) {res.sendStatus(401);return;}
  if (blobUploadStatus() !== 'enabled') {res.status(503).json({error:'Private uploads are disabled.'});return;}
  const id=req.params.id;
  if (typeof id !== 'string' || !isBlobObjectPath('/blob-uploads/'+id)) {res.sendStatus(400);return;}
  const objectPath='/blob-uploads/'+id;
  const [intent]=await db.select().from(uploadIntentsTable).where(and(
    eq(uploadIntentsTable.objectPath,objectPath),eq(uploadIntentsTable.userId,req.user.id),
  )).limit(1);
  if (!intent) {res.sendStatus(404);return;}
  if (Date.now()-intent.createdAt.getTime()>15*60_000) {res.status(410).json({error:'Upload expired.'});return;}
  const bytes=Buffer.isBuffer(req.body)?req.body:Buffer.alloc(0);
  if (bytes.length!==intent.sizeBytes || bytes.length===0 || bytes.length>MAX_BLOB_FILE_BYTES) {
    res.status(400).json({error:'Upload size mismatch.'});return;
  }
  try {
    validateDeclaredMaterialType(intent.fileName,req.get('content-type') || 'application/octet-stream');
    validateMaterialSignature(intent.fileName,bytes);
    await savePrivateBlob(objectPath,bytes,intent.contentType);
    res.sendStatus(204);
  } catch(error) {
    if (error instanceof MaterialReadError) {res.status(415).json({error:error.message});return;}
    req.log.warn({errorType:error instanceof Error?error.name:'Unknown'},'Private upload failed');
    res.status(503).json({error:'Upload unavailable or already received. Please request a fresh upload URL.'});
  }
});

/** Short-lived private read URL after an owner-scoped DB lookup. */
router.get('/storage/objects/blob/:id',async(req,res)=>{
  if (!hasAuthenticatedSession(req)) {res.sendStatus(401);return;}
  const id=req.params.id;
  if(typeof id!=='string'||!isBlobObjectPath('/blob-uploads/'+id)){res.sendStatus(404);return;}
  const objectPath='/blob-uploads/'+id;
  const [material]=await db.select({
    id:studyMaterialsTable.id,fileName:studyMaterialsTable.fileName,
  }).from(studyMaterialsTable).where(and(
    eq(studyMaterialsTable.objectPath,objectPath),eq(studyMaterialsTable.userId,req.user.id),
  )).limit(1);
  if(!material){res.sendStatus(404);return;}
  try {
    const signed=await privateBlobDownload(objectPath,material.fileName);
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('Referrer-Policy','no-referrer');
    res.redirect(302,signed.url);
  } catch(error) {
    if(isBlobMissing(error)){res.sendStatus(404);return;}
    req.log.warn({materialId:material.id},'Private download signing unavailable');
    res.status(503).json({error:'Document download temporarily unavailable.'});
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    const canAccess = await objectStorageService.canAccessObjectEntity({
      userId: req.user.id,
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!canAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
