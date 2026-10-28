import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { build } = require("esbuild");
const tmp = await mkdtemp(path.join(tmpdir(), "cabo-qstash-"));
const outfile = path.join(tmp, "job.mjs");
try {
  await build({
    entryPoints: [fileURLToPath(new URL("../lib/qstashMaterialPreview.ts", import.meta.url))],
    platform: "node", bundle: true, format: "esm", outfile, logLevel: "silent",
  });
  const { verifyQstashCallback, publishPreviewJob, qstashConfigured } = await import(pathToFileURL(outfile).href);
  const env = {
    ENABLE_QSTASH_MATERIAL_PREVIEW: "true",
    QSTASH_MATERIAL_PREVIEW_URL: "https://cabo-demo.example.invalid/api/internal/qstash/material-preview",
    QSTASH_CURRENT_SIGNING_KEY: "fake-test-signing-key-current",
    QSTASH_NEXT_SIGNING_KEY: "fake-test-signing-key-next",
    QSTASH_TOKEN: "fake-test-publish-token",
  };
  const now = 1_798_000_000;
  const body = Buffer.from('{"version":1,"materialId":17}');
  function sign(key, raw = body, overrides = {}) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const claims = {
      iss: "Upstash",
      sub: env.QSTASH_MATERIAL_PREVIEW_URL,
      iat: now - 5,
      nbf: now - 5,
      exp: now + 300,
      body: createHash("sha256").update(raw).digest("base64url"),
      ...overrides,
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const signed = header + "." + payload;
    return signed + "." + createHmac("sha256", key).update(signed).digest("base64url");
  }

  test("QStash material background processing is off by default and requires both keys", () => {
    assert.equal(qstashConfigured({}), false);
    assert.equal(qstashConfigured(env), true);
    assert.equal(qstashConfigured({...env, QSTASH_TOKEN: ""}), false);
    assert.equal(qstashConfigured({...env, QSTASH_CURRENT_SIGNING_KEY: ""}), false);
    assert.equal(qstashConfigured({...env, QSTASH_MATERIAL_PREVIEW_URL: "http://localhost"}), false);
    assert.equal(qstashConfigured({...env, ENABLE_QSTASH_MATERIAL_PREVIEW: "false"}), false);
  });

  test("valid signatures authenticate exact raw bytes with key rotation", () => {
    assert.equal(verifyQstashCallback(sign(env.QSTASH_CURRENT_SIGNING_KEY), body, env, now), true);
    assert.equal(verifyQstashCallback(sign(env.QSTASH_NEXT_SIGNING_KEY), body, env, now), true);
  });

  test("missing, altered or expired callbacks fail closed", () => {
    const signature = sign(env.QSTASH_CURRENT_SIGNING_KEY);
    assert.equal(verifyQstashCallback(undefined, body, env, now), false);
    assert.equal(verifyQstashCallback(signature, Buffer.from('{"version":1,"materialId":18}'), env, now), false);
    assert.equal(verifyQstashCallback(signature, body, env, now + 1000), false);
    assert.equal(verifyQstashCallback(sign(env.QSTASH_CURRENT_SIGNING_KEY,body,{nbf:now+30}),body,env,now),false);
    assert.equal(verifyQstashCallback(sign(env.QSTASH_CURRENT_SIGNING_KEY,body,{iss:"Attacker"}),body,env,now),false);
    assert.equal(verifyQstashCallback(sign(env.QSTASH_CURRENT_SIGNING_KEY,body,{sub:"https://wrong.example.com"}),body,env,now),false);
    assert.equal(verifyQstashCallback(sign("wrong-key"),body,env,now),false);
    assert.equal(verifyQstashCallback(signature,body,{...env,QSTASH_NEXT_SIGNING_KEY:"",QSTASH_CURRENT_SIGNING_KEY:""},now),false);
    assert.equal(verifyQstashCallback("garbage",body,env,now),false);
  });

  test("publish uses EU QStash REST and sends only opaque material ID", async () => {
    let captured;
    const fetcher = async (url, options) => {
      captured = { url:String(url), headers: options.headers, body:options.body };
      return Response.json({ messageId:"test" });
    };
    await publishPreviewJob({ version:1, materialId:17 }, fetcher, env);
    assert.ok(captured.url.startsWith("https://qstash-eu-central-1.upstash.io/v2/publish/https://"));
    assert.equal(captured.headers["Upstash-Retries"], "2");
    assert.match(captured.headers["Upstash-Deduplication-Id"], /^cabo-preview-[a-f0-9]{12}-17$/);
    assert.deepEqual(JSON.parse(captured.body), {version:1,materialId:17});
    assert.ok(!captured.body.includes("userId") && !captured.body.includes("learner"));
  });

  test("publish rejects missing keys and upstream error without exposing secrets", async () => {
    await assert.rejects(
      publishPreviewJob({version:1,materialId:17}, async()=>Response.json({}, {status:503}), env),
      /Unable to queue/,
    );
    await assert.rejects(publishPreviewJob({version:1,materialId:0}, async()=>Response.json({}), env));
  });
} finally {
  // All Node tests are registered synchronously above; cleanup after they run.
  after(async () => { await rm(tmp,{recursive:true,force:true}); });
}
