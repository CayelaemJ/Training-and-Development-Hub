import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
const version = process.argv[2] ?? "20261021_learner_success_loop";
if(!/^2026[0-9]{4}_[a-z_]+$/.test(version))throw Error("Invalid migration version");
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SELECT pg_advisory_xact_lock(641827331)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS cabo_schema_migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const sql = await readFile(
    new URL(`../migrations/${version}.sql`, import.meta.url),
    "utf8",
  );
  const checksum = createHash("sha256").update(sql).digest("hex");
  const previous = await client.query(
    "SELECT checksum FROM cabo_schema_migrations WHERE version=$1",
    [version],
  );
  if (previous.rows.length) {
    if (previous.rows[0].checksum !== checksum)
      throw Object.assign(Error("Migration checksum mismatch"), {
        code: "MIGRATION_DRIFT",
      });
  } else {
    await client.query(sql);
    await client.query(
      "INSERT INTO cabo_schema_migrations(version,checksum) VALUES($1,$2)",
      [version, checksum],
    );
  }
  await client.query("COMMIT");
  console.log("Additive migration verified");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Migration failed", error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await client.end();
}
