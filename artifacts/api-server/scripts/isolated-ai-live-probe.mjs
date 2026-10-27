/**
 * Isolated Render-only CABO inference probe. Reuses the *actual* production
 * completeAIJson implementation without starting the application or opening
 * a learner database connection. Never accepts prompts from the network.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

if (process.env.CABO_ENVIRONMENT !== "testing" ||
    process.env.CABO_AI_LIVE_PROBE !== "true") {
  throw new Error("Live AI probe is only allowed in explicitly enabled testing");
}
const port = Number(process.env.PORT || 10000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid integer");
}

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const probeDist = join(packageDir, "dist", "isolated-ai-completion.mjs");
await mkdir(join(packageDir, "dist"), { recursive: true });
await build({
  entryPoints: [join(packageDir, "src", "lib", "aiCompletion.ts")],
  outfile: probeDist, platform: "node", format: "esm",
  bundle: true, packages: "external", logLevel: "silent",
});
const { completeAIJson } = await import(pathToFileURL(probeDist).href);
const checked = {
  groq: { status: "pending" },
  huggingface: { status: "pending" },
};
let complete = false;

const server = createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" || req.url?.split("?")[0] !== "/healthz") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  const ready = complete &&
    checked.groq.status === "passed" &&
    checked.huggingface.status === "passed";
  res.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: ready ? "ready" : "not_ready" }));
});
server.listen(port, "0.0.0.0", () => {
  console.info("CABO synthetic inference readiness probe listening");
});

const hasKey = {
  groq: Boolean(process.env.GROQ_API_KEY?.trim()),
  huggingface: Boolean(
    process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_API_KEY?.trim()
  ),
};
for (const provider of ["groq", "huggingface"]) {
  if (!hasKey[provider]) {
    checked[provider] = { status: "unconfigured" };
    console.warn(JSON.stringify({ event: "cabo_ai_live_probe", provider, status: "unconfigured" }));
    continue;
  }
  const start = Date.now();
  try {
    const result = await completeAIJson({
      provider, task: "generic", maxCompletionTokens: 512,
      system: "You are a classroom science assistant. Return JSON exactly with status READY and answer photosynthesis. No personal data.",
      payload: { synthetic: true, question: "What process lets plants convert light into chemical energy?" },
      validate(value) {
        if (value?.status !== "READY" ||
            typeof value.answer !== "string" ||
            !value.answer.toLowerCase().includes("photosynthesis")) {
          throw new Error("AI returned an invalid or ungrounded synthetic answer");
        }
        return { status: "READY" };
      },
    });
    checked[provider] = { status: "passed" };
    console.info(JSON.stringify({
      event: "cabo_ai_live_probe", provider, status: "passed",
      model: result.modelId, latencyMs: Date.now() - start,
    }));
  } catch (error) {
    checked[provider] = { status: "failed" };
    console.warn(JSON.stringify({
      event: "cabo_ai_live_probe", provider, status: "failed",
      errorType: error instanceof Error ? error.name : "unknown",
      latencyMs: Date.now() - start,
    }));
  }
}
// Real end-to-end degraded-mode check: if HF is unavailable, generation
// should still return validated output via the functioning Groq provider.
let fallbackStatus = "not_checked";
if (hasKey.groq && hasKey.huggingface) {
  const start = Date.now();
  try {
    const result = await completeAIJson({
      task: "exam_generation",
      system: "Create one simple grounded synthetic science answer. Return JSON with status READY and answer photosynthesis.",
      payload: { synthetic: true, prompt: "Identify the process by which plants use sunlight to create chemical energy." },
      maxCompletionTokens: 512,
      validate(value) {
        if (value?.status !== "READY" ||
          typeof value.answer !== "string" ||
          !value.answer.toLowerCase().includes("photosynthesis")) {
          throw Error("Generated result was not grounded");
        }
        return { status: "READY" };
      },
    });
    fallbackStatus = result.provider === "groq" ? "groq_validated" : "hf_validated";
    console.info(JSON.stringify({
      event: "cabo_ai_live_fallback", status: "passed", provider: result.provider,
      model: result.modelId, latencyMs: Date.now() - start,
    }));
  } catch (error) {
    fallbackStatus = "failed";
    console.warn(JSON.stringify({
      event: "cabo_ai_live_fallback", status: "failed",
      errorType: error instanceof Error ? error.name : "unknown",
      latencyMs: Date.now() - start,
    }));
  }
}
complete = true;
console.info(JSON.stringify({
  event: "cabo_ai_live_probe_summary",
  ready: checked.groq.status === "passed" && checked.huggingface.status === "passed",
  groq: checked.groq.status, huggingface: checked.huggingface.status,
  fallback: fallbackStatus,
}));
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
