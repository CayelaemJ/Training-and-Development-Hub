import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

test("failed Hugging Face generation routes to Groq without a second HF call", async () => {
  const originalFetch = globalThis.fetch;
  const oldNodeEnv = process.env.NODE_ENV;
  const saved = Object.fromEntries(
    ["GROQ_API_KEY", "HF_TOKEN", "HUGGINGFACE_API_KEY", "OPENAI_API_KEY"]
      .map(k => [k, process.env[k]]),
  );
  const directory = await mkdtemp(path.join(fileURLToPath(new URL(".", import.meta.url)), ".reverse-ai-test-"));
  try {
    const outfile = path.join(directory, "aiCompletion.mjs");
    await build({
      entryPoints: [fileURLToPath(new URL("../lib/aiCompletion.ts", import.meta.url))],
      bundle: true, platform: "node", format: "esm", packages: "external",
      outfile, logLevel: "silent",
    });
    process.env.NODE_ENV = "production";
    process.env.GROQ_API_KEY = "synthetic-groq-test-key";
    process.env.HF_TOKEN = "synthetic-hf-test-key";
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.OPENAI_API_KEY;

    let hfCalls = 0, groqCalls = 0;
    globalThis.fetch = async input => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const json = (body, status = 200) => new Response(JSON.stringify(body), {
        status, headers: { "content-type": "application/json" },
      });
      if (url.includes("api.groq.com") && url.endsWith("/models")) {
        return json({ object: "list", data: [
          { id: "llama-3.1-8b-instant", object: "model", created: 1, owned_by: "groq" },
        ] });
      }
      if (url.includes("router.huggingface.co") && url.includes("/chat/completions")) {
        hfCalls++;
        return json({ error: { message: "Synthetic provider maintenance" } }, 503);
      }
      if (url.includes("api.groq.com") && url.includes("/chat/completions")) {
        groqCalls++;
        return json({
          id: "synthetic", object: "chat.completion", created: 1, model: "synthetic",
          choices: [{ index: 0, finish_reason: "stop", message: {
            role: "assistant", content: '{"status":"READY"}',
          } }],
        });
      }
      throw Error("Unexpected outbound synthetic request: " + url);
    };
    const { completeAIJson } = await import(pathToFileURL(outfile).href);
    const result = await completeAIJson({
      task: "exam_generation", system: "Return synthetic JSON", payload: { synthetic: true },
      maxCompletionTokens: 128,
      validate(value) {
        if (value?.status !== "READY") throw Error("Invalid");
        return value;
      },
    });
    assert.equal(result.provider, "groq");
    assert.equal(result.value.status, "READY");
    assert.equal(hfCalls, 1);
    assert.equal(groqCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
