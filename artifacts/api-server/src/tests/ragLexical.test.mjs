import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";

test("lexical index persists searchable chunks and enforces revocation and ownership", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cabo-rag-"));
  const database = new PGlite();
  const previousFlag = process.env.CABO_RAG_LEXICAL_ENABLED;
  const previousPool = globalThis.__caboRagTestPool;
  try {
    await database.exec(`
      CREATE TABLE users(id varchar PRIMARY KEY);
      CREATE TABLE study_materials(id integer PRIMARY KEY, user_id varchar,
        object_path text, allow_ai_reading boolean);
      CREATE TABLE cabo_r2_objects(object_key text PRIMARY KEY,
        owner_user_id varchar, state text, ai_read_consent boolean, deleted_at timestamptz);
      INSERT INTO users VALUES ('owner'), ('other');
      INSERT INTO study_materials VALUES (1, 'owner', 'quarantine/test', true);
      INSERT INTO cabo_r2_objects VALUES ('quarantine/test','owner','approved',true,NULL);
    `);
    await database.exec(await readFile(new URL("../../../../lib/db/migrations/20261113_rag_lexical_foundation.sql", import.meta.url), "utf8"));
    const query = async (sql, values) => {
      const result = await database.query(sql, values);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    };
    globalThis.__caboRagTestPool = { query, connect: async () => ({ query, release() {} }) };
    const outfile = path.join(directory, "rag.mjs");
    await build({
      entryPoints: [new URL("../lib/ragLexical.ts", import.meta.url).pathname],
      bundle: true, platform: "node", format: "esm", outfile,
      plugins: [{
        name: "isolated-rag-database",
        setup(builder) {
          builder.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "test-db", namespace: "rag-test" }));
          builder.onLoad({ filter: /.*/, namespace: "rag-test" }, () => ({
            contents: "export const pool = globalThis.__caboRagTestPool;", loader: "js",
          }));
        },
      }],
    });
    const rag = await import(pathToFileURL(outfile).href);
    const sourceText = ("  Photosynthesis converts light energy into chemical energy.\n\n" +
      "Plants use chlorophyll to absorb light. ").repeat(120);
    const prepared = rag.chunkMaterialText(sourceText);
    assert.ok(prepared.chunks.length > 1);
    for (const chunk of prepared.chunks) {
      assert.equal(prepared.source.slice(chunk.startChar, chunk.endChar), chunk.content);
      assert.ok(chunk.content.length <= 3000);
    }
    assert.throws(() => rag.chunkMaterialText("x".repeat(2_000_001)));
    await assert.rejects(rag.searchApprovedOwnerMaterial({ materialId: 1, ownerUserId: "owner", query: "light" }), rag.RagRetrievalUnavailableError);
    process.env.CABO_RAG_LEXICAL_ENABLED = "true";
    const indexed = await rag.replaceApprovedMaterialChunks({ materialId: 1, ownerUserId: "owner", objectKey: "quarantine/test", sourceText });
    assert.equal(indexed.chunkCount, prepared.chunks.length);
    const hits = await rag.searchApprovedOwnerMaterial({ materialId: 1, ownerUserId: "owner", query: "photosynthesis", limit: 100 });
    assert.ok(hits.length > 0 && hits.length <= 8);
    assert.deepEqual(await rag.searchApprovedOwnerMaterial({ materialId: 1, ownerUserId: "other", query: "photosynthesis" }), []);
    await assert.rejects(rag.replaceApprovedMaterialChunks({ materialId: 1, ownerUserId: "other", objectKey: "quarantine/test", sourceText }));
    await assert.rejects(rag.searchApprovedOwnerMaterial({ materialId: 1, ownerUserId: "owner", query: "light", limit: NaN }));
    await database.exec("UPDATE cabo_r2_objects SET ai_read_consent=false");
    assert.deepEqual(await rag.searchApprovedOwnerMaterial({ materialId: 1, ownerUserId: "owner", query: "photosynthesis" }), []);
    await database.exec("UPDATE cabo_r2_objects SET ai_read_consent=true; UPDATE study_materials SET object_path='replacement'");
    assert.deepEqual(await rag.searchApprovedOwnerMaterial({ materialId: 1, ownerUserId: "owner", query: "photosynthesis" }), []);
  } finally {
    if (previousFlag === undefined) delete process.env.CABO_RAG_LEXICAL_ENABLED;
    else process.env.CABO_RAG_LEXICAL_ENABLED = previousFlag;
    globalThis.__caboRagTestPool = previousPool;
    await database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
