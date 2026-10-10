import { Readable } from 'stream';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { and,eq } from 'drizzle-orm';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { db, uploadIntentsTable, materialUploadBlobsTable } from '@workspace/db';
import { Router, type IRouter, type Request, type Response } from 'express';

import { ObjectPermission } from '../lib/objectAcl';
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

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
      const extension = name.toLowerCase().split('.').pop();
      const supportedExtensions = new Set(['txt', 'md', 'pdf', 'docx']);
      if (!extension || !supportedExtensions.has(extension)) {
        res.status(400).json({
          error: 'Upload a TXT, Markdown, PDF, or DOCX file.',
        });
        return;
      }
      if (size > 20 * 1024 * 1024) {
        res.status(400).json({ error: 'Files must be 20 MB or smaller.' });
        return;
      }

      const railwayFallback = process.env.RAILWAY_ENVIRONMENT_NAME === 'testing';
      const objectPath = railwayFallback ? `/railway-uploads/${randomUUID()}` : '';
      const uploadURL = railwayFallback ? `/api/storage/uploads/railway/${objectPath.split('/').pop()}` : await objectStorageService.getObjectEntityUploadURL();
      const finalObjectPath = railwayFallback ? objectPath : objectStorageService.normalizeObjectEntityPath(uploadURL);
      await db.insert(uploadIntentsTable).values({
        objectPath: finalObjectPath,
        userId: req.user.id,
        fileName: name,
        contentType,
        sizeBytes: size,
      });

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath: finalObjectPath,
        }),
      );
    } catch (error) {
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
router.put('/storage/uploads/railway/:id',express.raw({type:'*/*',limit:'20mb'}),async(req,res)=>{
 if(!hasAuthenticatedSession(req)){res.status(401).json({error:'Unauthorized'});return}
 if(process.env.RAILWAY_ENVIRONMENT_NAME!=='testing'){res.sendStatus(404);return}
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
