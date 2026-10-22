import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { unlink } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const { build } = createRequire(
  path.join(root, "artifacts/api-server/package.json"),
)("esbuild");
const outfile = path.join(
  root,
  "artifacts/api-server/src/tests/integration/uploads-generated.mjs",
);
try {
  await build({
    entryPoints: [
      path.join(
        root,
        "artifacts/api-server/src/tests/integration/uploads.integration.ts",
      ),
    ],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile,
    alias: {
      "@workspace/api-zod": path.join(root, "lib/api-zod/src/index.ts"),
      "@workspace/db": path.join(
        root,
        "artifacts/api-server/src/tests/integration/supportTestDb.ts",
      ),
    },
    plugins: [
      {
        name: "test-dependencies",
        setup(b) {
          b.onResolve({ filter: /\/aiCompletion$/ }, () => ({
            path: path.join(
              root,
              "artifacts/api-server/src/tests/integration/uploadMockAI.ts",
            ),
          }));
          b.onResolve({ filter: /^drizzle-zod$/ }, () => ({
            path: path.join(root, "lib/db/node_modules/drizzle-zod/index.mjs"),
            external: true,
          }));
        },
      },
    ],
  });
  process.exitCode =
    spawnSync(process.execPath, [outfile], { cwd: root, stdio: "inherit" })
      .status ?? 1;
} finally {
  await unlink(outfile).catch(() => {});
}
