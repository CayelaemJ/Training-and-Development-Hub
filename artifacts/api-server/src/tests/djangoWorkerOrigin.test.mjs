import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { build } = require("esbuild");
const dir = await mkdtemp(join(tmpdir(), "cabo-django-worker-url-"));
after(async () => { await rm(dir, { recursive: true, force: true }); });
const outfile = join(dir, "django-worker-url.mjs");
await build({
  entryPoints: [fileURLToPath(new URL("../lib/djangoWorkerOrigin.ts", import.meta.url))],
  platform: "node",
  format: "esm",
  bundle: true,
  outfile,
  logLevel: "silent",
});
const { djangoWorkerDraftURL } = await import(pathToFileURL(outfile).href);
const approved = "https://cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev";

test("exact Cloudflare staging host is approved", () => {
  assert.equal(djangoWorkerDraftURL(approved).href, approved + "/v1/insights/draft");
  assert.equal(djangoWorkerDraftURL(approved + "/").href, approved + "/v1/insights/draft");
});

test("fail closed for hostname confusion, userinfo, path, query and protocol", () => {
  for (const malicious of [
    "http://cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev",
    approved + ".attacker.example",
    "https://attacker.example/cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev",
    "https://cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev@attacker.example/",
    "https://username@cabo-learning-django-insights-staging.cabo-solutions-za.workers.dev",
    approved + ":8080",
    approved + "/redirect",
    approved + "/v1/insights/draft",
    approved + "/?source=attacker",
    approved + "/#fragment",
    "https://127.0.0.1",
    "https://169.254.169.254",
    "https://localhost",
    "http://localhost",
    "file:///etc/passwd",
  ]) {
    assert.throws(() => djangoWorkerDraftURL(malicious), /Unapproved Django worker origin/, malicious);
  }
});

test("malformed worker URLs fail closed without resolving a network address", () => {
  for (const invalid of ["not-a-url", "", "://garbage"]) {
    assert.throws(() => djangoWorkerDraftURL(invalid));
  }
});
