import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = "lib/db/migrations";
const order = readFileSync(`${dir}/ORDER`, "utf8").split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
const files = readdirSync(dir).filter(f => f.endsWith(".sql")).map(f => f.slice(0, -4)).sort();

test("ORDER lists every reviewed migration exactly once", () => {
  assert.deepEqual([...order].sort(), files);
  assert.equal(new Set(order).size, order.length);
  for (const v of order) assert.match(v, /^2026[0-9]{4}_[a-z_]+$/, "runner accepts the version name");
});

test("every table a migration references is created earlier or belongs to the base schema", () => {
  const createdBy = new Map();
  for (const v of order) {
    for (const m of readFileSync(`${dir}/${v}.sql`, "utf8").matchAll(/create table if not exists\s+([a-z_]+)/gi)) createdBy.set(m[1], v);
  }
  const seen = new Set();
  for (const v of order) {
    const sql = readFileSync(`${dir}/${v}.sql`, "utf8").replace(/--.*$/gm, "");
    const created = new Set([...sql.matchAll(/create table if not exists\s+([a-z_]+)/gi)].map(m => m[1]));
    for (const m of sql.matchAll(/references\s+([a-z_]+)/gi)) {
      const table = m[1];
      if (!createdBy.has(table) || created.has(table)) continue;
      assert.ok(seen.has(table), `${v} references ${table} before ${createdBy.get(table)} creates it`);
    }
    for (const t of created) seen.add(t);
  }
});

test("pilot startup applies ORDER only behind an explicit flag and never pushes schema", () => {
  const start = readFileSync("scripts/render-start.sh", "utf8");
  assert.match(start, /APPLY_REVIEWED_MIGRATIONS:-false\}" == "true"/);
  assert.match(start, /lib\/db\/migrations\/ORDER/);
  assert.match(start, /set -euo pipefail/);
  assert.doesNotMatch(start, /drizzle-kit|db push|push --force/);
});
