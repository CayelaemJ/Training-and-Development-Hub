import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Offline guardrail: regression checks for the staging-only Django deploy.
// This deliberately does not deploy, read credentials, or contact Cloudflare.
const config = readFileSync(new URL("../../../../.circleci/config.yml", import.meta.url), "utf8");
// The same key appears in pipeline.parameters and jobs. Only inspect the
// actual job definition; otherwise the test can silently check the wrong block.
const jobsStart = config.indexOf("\njobs:\n");
const workflowsStart = config.indexOf("\nworkflows:\n", jobsStart);
assert.ok(jobsStart >= 0 && workflowsStart > jobsStart, "CircleCI must define jobs and workflows");
const jobs = config.slice(jobsStart + "\njobs:\n".length, workflowsStart);
const header = "\n  deploy_django_staging:\n";
const deployStart = ("\n" + jobs).indexOf(header);
assert.ok(deployStart >= 0, "Django staging deploy job must exist under jobs");
const remaining = ("\n" + jobs).slice(deployStart + header.length);
const nextJob = remaining.search(/^  [a-z_][a-z0-9_]*:\s*$/m);
const deployJob = nextJob >= 0 ? remaining.slice(0, nextJob) : remaining;
assert.ok(deployJob.includes("Refusing unexpected Cloudflare account"), "Deployment job must have restrictive preflight");

test("deployment requires an explicitly approved staging environment", () => {
  assert.match(deployJob, /CABO_ENVIRONMENT:-.*staging/);
  assert.match(deployJob, /CABO_DJANGO_STAGING_PRIVACY_APPROVED:-.*true/);
  assert.match(deployJob, /Refusing deploy without staging environment and privacy approval/);
});

test("deployment destination and Cloudflare account remain restricted", () => {
  assert.match(deployJob, /CLOUDFLARE_ACCOUNT_ID:-/);
  assert.match(deployJob, /Refusing unexpected Cloudflare account/);
  assert.match(deployJob, /CABO_DJANGO_WORKER_URL:-/);
  assert.match(deployJob, /Refusing unexpected staging destination/);
});

test("required credentials are provided privately and deployment stays opt-in", () => {
  for (const name of ["CLOUDFLARE_API_TOKEN", "DJANGO_SECRET_KEY", "DJANGO_WORKER_TOKEN"]) {
    assert.ok(deployJob.includes("${" + name + ":?"), `${name} must be required by deploy preflight`);
  }
  assert.match(config, /deploy_django_staging:\s*\n\s*type: boolean\s*\n\s*default: false/);
  assert.match(config, /context: cabo-cloudflare-staging/);
  assert.match(config, /branches:\s*\n\s*only: main/);
});
