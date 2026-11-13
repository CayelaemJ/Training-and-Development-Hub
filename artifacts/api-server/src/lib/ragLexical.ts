import { createHash } from "node:crypto";
import { pool } from "@workspace/db";

const MIN_CHUNK = 900;
const TARGET_CHUNK = 2200;
const MAX_CHUNK = 3000;
const OVERLAP = 260;
const MAX_QUERY = 500;
const MAX_RESULTS = 8;
const MAX_SOURCE = 2_000_000;

export type MaterialChunk = {
  chunkIndex: number;
  startChar: number;
  endChar: number;
  content: string;
  contentSha256: string;
};

export type LexicalMaterialMatch = {
  chunkId: number;
  materialId: number;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  content: string;
  score: number;
};

export class RagRetrievalUnavailableError extends Error {
  constructor() {
    super("Grounded material search is not enabled.");
    this.name = "RagRetrievalUnavailableError";
  }
}

export function lexicalRagEnabled(): boolean {
  return process.env.CABO_RAG_LEXICAL_ENABLED === "true";
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedSource(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
}

function boundary(text: string, start: number, preferredEnd: number): number {
  const hardEnd = Math.min(text.length, start + MAX_CHUNK);
  if (hardEnd === text.length) return hardEnd;
  const floor = Math.min(hardEnd, start + MIN_CHUNK);
  const window = text.slice(floor, hardEnd);
  const preferred = Math.max(0, preferredEnd - floor);
  const candidates = [
    window.lastIndexOf("\n\n", preferred),
    window.lastIndexOf(". ", preferred),
    window.lastIndexOf("\n", preferred),
    window.lastIndexOf(" ", preferred),
  ].filter(index => index >= 0);
  const chosen = candidates.length ? Math.max(...candidates) : -1;
  return chosen >= 0 ? floor + chosen + 1 : hardEnd;
}

/** Deterministic paragraph-aware chunks. Offsets always refer to normalized text. */
export function chunkMaterialText(text: string): { source: string; sourceVersion: string; chunks: MaterialChunk[] } {
  const source = normalizedSource(text);
  if (source.length > MAX_SOURCE) throw new Error("Material is too large to index.");
  if (source.length < 30) throw new Error("Material has insufficient readable text.");
  const chunks: MaterialChunk[] = [];
  let start = 0;
  while (start < source.length) {
    const end = boundary(source, start, start + TARGET_CHUNK);
    const raw = source.slice(start, end);
    const content = raw.trim();
    const leading = raw.length - raw.trimStart().length;
    if (content.length >= 30) {
      chunks.push({
        chunkIndex: chunks.length,
        startChar: start + leading,
        endChar: start + leading + content.length,
        content,
        contentSha256: sha256(content),
      });
    }
    if (end >= source.length) break;
    const next = Math.max(start + 1, end - OVERLAP);
    start = source.indexOf(" ", next);
    if (start < 0 || start >= end) start = next;
  }
  if (!chunks.length) throw new Error("Material has insufficient readable text.");
  return { source, sourceVersion: sha256(source), chunks };
}

/**
 * Replace one material's chunks only after the DB confirms owner identity,
 * R2 approval and explicit AI-reading consent. No request-supplied tenant or
 * approval value is trusted.
 */
export async function replaceApprovedMaterialChunks(input: {
  materialId: number;
  ownerUserId: string;
  objectKey: string;
  sourceText: string;
}): Promise<{ sourceVersion: string; chunkCount: number }> {
  if (!lexicalRagEnabled()) throw new RagRetrievalUnavailableError();
  if (!Number.isSafeInteger(input.materialId) || input.materialId < 1 ||
      !input.ownerUserId || input.ownerUserId.length > 128 ||
      !input.objectKey || input.objectKey.length > 512) {
    throw new Error("Invalid material indexing request.");
  }
  const prepared = chunkMaterialText(input.sourceText);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    const approval = await client.query(
      `SELECT 1
         FROM study_materials m
         JOIN cabo_r2_objects o ON o.object_key = m.object_path
        WHERE m.id = $1 AND m.user_id = $2 AND m.object_path = $3
          AND m.allow_ai_reading = true
          AND o.owner_user_id = $2 AND o.state = 'approved'
          AND o.ai_read_consent = true AND o.deleted_at IS NULL
        FOR UPDATE OF m, o`,
      [input.materialId, input.ownerUserId, input.objectKey],
    );
    if (approval.rowCount !== 1) throw new Error("Material is not approved for retrieval.");

    await client.query(
      "DELETE FROM cabo_material_chunks WHERE material_id = $1 AND owner_user_id = $2",
      [input.materialId, input.ownerUserId],
    );
    await client.query(
      `INSERT INTO cabo_material_chunks
        (material_id, owner_user_id, object_key, source_version, chunk_index,
         start_char, end_char, content, content_sha256)
       SELECT $1, $2, $3, $4, x.chunk_index, x.start_char, x.end_char,
              x.content, x.content_sha256
         FROM jsonb_to_recordset($5::jsonb) AS x(
           chunk_index integer, start_char integer, end_char integer,
           content text, content_sha256 text
         )`,
      [input.materialId, input.ownerUserId, input.objectKey, prepared.sourceVersion,
       JSON.stringify(prepared.chunks.map(chunk => ({
         chunk_index: chunk.chunkIndex, start_char: chunk.startChar,
         end_char: chunk.endChar, content: chunk.content,
         content_sha256: chunk.contentSha256,
       })))],
    );
    await client.query("COMMIT");
    return { sourceVersion: prepared.sourceVersion, chunkCount: prepared.chunks.length };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve original */ }
    throw error;
  } finally {
    client.release();
  }
}

/** Owner-filtered lexical retrieval. Authorization and consent remain inside SQL. */
export async function searchApprovedOwnerMaterial(input: {
  materialId: number;
  ownerUserId: string;
  query: string;
  limit?: number;
}): Promise<LexicalMaterialMatch[]> {
  if (!lexicalRagEnabled()) throw new RagRetrievalUnavailableError();
  const query = input.query.replace(/\s+/g, " ").trim();
  if (input.limit !== undefined && (!Number.isSafeInteger(input.limit) || input.limit < 1)) {
    throw new Error("Invalid search result limit.");
  }
  const limit = Math.min(MAX_RESULTS, input.limit ?? 6);
  if (!Number.isSafeInteger(input.materialId) || input.materialId < 1 ||
      !input.ownerUserId || input.ownerUserId.length > 128 ||
      query.length < 2 || query.length > MAX_QUERY) {
    throw new Error("Invalid material search request.");
  }
  const result = await pool.query<{
    chunk_id: string; material_id: number; chunk_index: number;
    start_char: number; end_char: number; content: string; score: number;
  }>(
    `WITH q AS (SELECT websearch_to_tsquery('simple', $3) AS value)
     SELECT c.id::text AS chunk_id, c.material_id, c.chunk_index,
            c.start_char, c.end_char, c.content,
            ts_rank_cd(c.search_vector, q.value)::real AS score
       FROM cabo_material_chunks c
       JOIN study_materials m ON m.id = c.material_id AND m.user_id = $1
       JOIN cabo_r2_objects o ON o.object_key = c.object_key
       CROSS JOIN q
      WHERE c.owner_user_id = $1 AND c.material_id = $2
        AND m.object_path = c.object_key
        AND m.allow_ai_reading = true
        AND o.owner_user_id = $1 AND o.state = 'approved'
        AND o.ai_read_consent = true AND o.deleted_at IS NULL
        AND c.search_vector @@ q.value
      ORDER BY score DESC, c.chunk_index ASC
      LIMIT $4`,
    [input.ownerUserId, input.materialId, query, limit],
  );
  return result.rows.map(row => ({
    chunkId: Number(row.chunk_id),
    materialId: row.material_id,
    chunkIndex: row.chunk_index,
    startChar: row.start_char,
    endChar: row.end_char,
    content: row.content,
    score: Number(row.score),
  }));
}
