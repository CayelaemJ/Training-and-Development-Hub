import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";

const repeat = (sentence) => Array.from({ length: 80 }, () => sentence).join(" ");
const cases = [
  { query: "chlorophyll absorbs sunlight leaves", terms: ["chlorophyll", "sunlight"] },
  { query: "evaporation liquid water heat", terms: ["evaporation", "liquid", "heat"] },
  { query: "fraction numerator denominator", terms: ["fraction", "numerator", "denominator"] },
];

function rankMetrics(results, relevantTerms) {
  const rank = results.findIndex((result) => {
    const text = result.content.toLowerCase();
    return relevantTerms.every((term) => text.includes(term));
  });
  return { hitAt3: rank >= 0 ? 1 : 0, reciprocalRank: rank >= 0 ? 1 / (rank + 1) : 0 };
}

test("reproducible RAG lexical quality: gold queries retrieve their grounded passage", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cabo-rag-eval-"));
  const database = new PGlite();
  const priorFlag = process.env.CABO_RAG_LEXICAL_ENABLED;
  const priorPool = globalThis.__caboRagTestPool;
  try {
    await database.exec(`
      CREATE TABLE users(id varchar PRIMARY KEY);
      CREATE TABLE study_materials(id integer PRIMARY KEY, user_id varchar, object_path text, allow_ai_reading boolean);
      CREATE TABLE cabo_r2_objects(object_key text PRIMARY KEY, owner_user_id varchar, state text,
        ai_read_consent boolean, deleted_at timestamptz);
      INSERT INTO users VALUES ('synthetic-owner'), ('synthetic-other');
      INSERT INTO study_materials VALUES (1, 'synthetic-owner', 'approved/gold-material', true);
      INSERT INTO cabo_r2_objects VALUES ('approved/gold-material', 'synthetic-owner', 'approved', true, NULL);
    `);
    await database.exec(await readFile(new URL("../../../../lib/db/migrations/20261113_rag_lexical_foundation.sql", import.meta.url), "utf8"));
    const query = async (sql, values) => {
      const result = await database.query(sql, values);
      return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
    };
    globalThis.__caboRagTestPool = { query, connect: async () => ({ query, release() {} }) };
    const outfile = path.join(directory, "rag-eval.mjs");
    await build({
      entryPoints: [new URL("../lib/ragLexical.ts", import.meta.url).pathname],
      bundle: true, platform: "node", format: "esm", outfile,
      plugins: [{
        name: "isolated-rag-evaluation-database",
        setup(builder) {
          builder.onResolve({ filter: /^@workspace\\/db$/ }, () => ({ path: "test-db", namespace: "rag-test" }));
          builder.onLoad({ filter: /.*/, namespace: "rag-test" }, () => ({
            contents: "export const pool = globalThis.__caboRagTestPool;", loader: "js",
          }));
        },
      }],
    });
    const rag = await import(pathToFileURL(outfile).href);
    process.env.CABO_RAG_LEXICAL_ENABLED = "true";
    const source = [
      repeat("Chlorophyll absorbs sunlight in green leaves and helps plants convert light energy into chemical energy."),
      repeat("Evaporation changes liquid water into water vapour when heat gives the molecules more energy."),
      repeat("A fraction represents part of a whole; its numerator counts selected parts and denominator counts equal parts."),
    ].join("\n\n");
    await rag.replaceApprovedMaterialChunks({
      materialId: 1, ownerUserId: "synthetic-owner", objectKey: "approved/gold-material", sourceText: source,
    });

    const perQuery = [];
    for (const gold of cases) {
      const results = await rag.searchApprovedOwnerMaterial({
        materialId: 1, ownerUserId: "synthetic-owner", query: gold.query, limit: 3,
      });
      assert.ok(results.length > 0, `no results for gold query: ${gold.query}`);
      perQuery.push(rankMetrics(results, gold.terms));
    }
    const hitAt3 = perQuery.reduce((sum, metric) => sum + metric.hitAt3, 0) / cases.length;
    const meanReciprocalRank = perQuery.reduce((sum, metric) => sum + metric.reciprocalRank, 0) / cases.length;
    assert.ok(hitAt3 >= 0.9, `Hit@3=${hitAt3}; minimum is 0.9`);
    assert.ok(meanReciprocalRank >= 0.8, `MRR=${meanReciprocalRank}; minimum is 0.8`);

    // Guard the authorization boundary: another principal must not see matching content.
    const unauthorized = await rag.searchApprovedOwnerMaterial({
      materialId: 1, ownerUserId: "synthetic-other", query: cases[0].query, limit: 3,
    });
    assert.deepEqual(unauthorized, []);
  } finally {
    if (priorFlag === undefined) delete process.env.CABO_RAG_LEXICAL_ENABLED;
    else process.env.CABO_RAG_LEXICAL_ENABLED = priorFlag;
    globalThis.__caboRagTestPool = priorPool;
    await database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
