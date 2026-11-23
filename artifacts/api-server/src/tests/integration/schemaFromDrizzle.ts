// Builds the full test database from the real Drizzle schema (lib/db/src/schema)
// with the drizzle-kit API, so integration tests cannot drift from production
// tables. Also provides a helper to advance serial sequences after seeding
// rows with explicit ids.
import { createRequire } from "node:module";
import * as schema from "../../../../../lib/db/src/schema";
import { engine } from "./supportTestDb";

export async function createSchemaFromDrizzle(): Promise<number> {
  const kit = createRequire(process.cwd() + "/lib/db/package.json")("drizzle-kit/api");
  const statements: string[] = await kit.generateMigration(kit.generateDrizzleJson({}), kit.generateDrizzleJson(schema as Record<string, unknown>));
  // drizzle-kit emits foreign keys before indexes, but a composite foreign key
  // (e.g. ml_eval -> ml_model_versions(id, organization_id)) needs its unique
  // index to exist first. Apply tables, then indexes, then foreign keys.
  const isForeignKey = (s: string) => /FOREIGN KEY/i.test(s);
  const isIndex = (s: string) => /^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(s);
  const ordered = [...statements.filter(s => !isForeignKey(s) && !isIndex(s)), ...statements.filter(isIndex), ...statements.filter(isForeignKey)];
  for (const statement of ordered) await engine.exec(statement);
  return statements.length;
}

// Seed rows with explicit ids do not advance serial sequences; without this the
// next insert by a route reuses id 1 and ON CONFLICT DO NOTHING silently skips it.
export async function syncSequences(tables: string[]): Promise<void> {
  for (const table of tables) {
    if (!/^[a-z_]+$/.test(table)) throw new Error(`Unexpected table name ${table}`);
    await engine.exec(`SELECT setval(pg_get_serial_sequence('${table}','id'), GREATEST((SELECT coalesce(max(id),0) FROM ${table}),1))`);
  }
}
