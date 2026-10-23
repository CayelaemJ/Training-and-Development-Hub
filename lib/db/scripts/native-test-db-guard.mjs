import pg from "pg";

// Guardrail for the isolated CABO native pilot: the schema push is allowed
// ONLY on a completely EMPTY public schema and ONLY after explicit flags.
// On later starts a deployment marker must match the configured test project.
const env = process.env;
const marker = env.CABO_TEST_DATABASE_MARKER || "";
if (env.CABO_ENVIRONMENT !== "testing" ||
    env.CABO_TEST_DATABASE_ISOLATED !== "true" ||
    env.CABO_NATIVE_TEST_BOOTSTRAP !== "true" ||
    !/^[a-z0-9-]{10,80}$/.test(marker) || !env.DATABASE_URL) {
  throw Error("Native test bootstrap requires explicitly isolated test settings.");
}
const client = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 6000 });
try {
  await client.connect();
  const mode = process.argv[2];
  const tables = await client.query(`
    SELECT tablename FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
  `);
  const hasMarker = tables.rows.some(row => row.tablename === "cabo_native_test_marker");
  if (mode === "check") {
    if (tables.rows.length === 0) {
      process.stdout.write("EMPTY\n");
    } else {
      if (!hasMarker) throw Error("Existing unmarked database: refusing bootstrap.");
      const result = await client.query("SELECT marker FROM cabo_native_test_marker LIMIT 1");
      if (result.rows.length !== 1 || result.rows[0].marker !== marker)
        throw Error("Test database deployment marker mismatch.");
      process.stdout.write("READY\n");
    }
  } else if (mode === "mark") {
    if (env.CABO_NATIVE_TEST_BOOTSTRAP_GRANTED !== "true" || tables.rows.length === 0 || hasMarker)
      throw Error("Refusing to mark a nonempty or previously marked deployment.");
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE cabo_native_test_marker (
        marker text PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query("INSERT INTO cabo_native_test_marker(marker) VALUES($1)", [marker]);
    await client.query("COMMIT");
    process.stdout.write("Native test deployment marker recorded.\n");
  } else {
    throw Error("Specify check or mark mode.");
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  // No DATABASE_URL or credentials in logs.
  console.error("Native test database guard refused the operation:", e instanceof Error ? e.message : "unknown");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
