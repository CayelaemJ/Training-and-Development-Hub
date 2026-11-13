import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { build } = require("esbuild");
const dir = await mkdtemp(join(tmpdir(), "cabo-django-stage-policy-"));
after(async () => { await rm(dir, { recursive: true, force: true }); });
const outfile = join(dir, "policy.mjs");
await build({
  entryPoints: [fileURLToPath(new URL("../lib/djangoWorkerStagePolicy.ts", import.meta.url))],
  platform: "node", format: "esm", bundle: true, outfile, logLevel: "silent",
});
const { djangoInsightsStagingEnabled } = await import(pathToFileURL(outfile).href);

const approved = {
  ENABLE_CABO_DJANGO_INSIGHTS: "true",
  CABO_ENVIRONMENT: "staging",
  CABO_DJANGO_STAGING_PRIVACY_APPROVED: "true",
};

test("Django staging is completely off without explicit configuration", () => {
  assert.equal(djangoInsightsStagingEnabled({}), false);
  assert.equal(djangoInsightsStagingEnabled({ENABLE_CABO_DJANGO_INSIGHTS:"true"}), false);
});

test("staging or testing requires an explicit privacy approval", () => {
  for (const env of ["staging","testing"]) {
    assert.equal(djangoInsightsStagingEnabled({...approved,CABO_ENVIRONMENT:env}), true);
    assert.equal(djangoInsightsStagingEnabled({...approved,CABO_ENVIRONMENT:env,CABO_DJANGO_STAGING_PRIVACY_APPROVED:"false"}), false);
    assert.equal(djangoInsightsStagingEnabled({...approved,CABO_ENVIRONMENT:env,CABO_DJANGO_STAGING_PRIVACY_APPROVED:undefined}), false);
  }
});

test("production and unknown environments cannot connect even when flags are enabled", () => {
  for (const env of [undefined,"", "production","prod", "preview", "development","PRODUCTION"]) {
    assert.equal(djangoInsightsStagingEnabled({...approved,CABO_ENVIRONMENT:env}),false);
  }
});

test("flag values must be exact, not truthy or loosely interpreted", () => {
  for (const value of ["1","TRUE","yes","on"," true","True",undefined]) {
    assert.equal(djangoInsightsStagingEnabled({...approved,ENABLE_CABO_DJANGO_INSIGHTS:value}),false);
    assert.equal(djangoInsightsStagingEnabled({...approved,CABO_DJANGO_STAGING_PRIVACY_APPROVED:value}),false);
  }
});
