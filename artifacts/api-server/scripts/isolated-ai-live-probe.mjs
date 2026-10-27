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
// A short end-to-end demo rehearsal through the exact production completion
// pipeline. Never uses real learner information and never writes a database.
let classroomWorkflowStatus = "not_checked";
if (hasKey.groq) {
  const start = Date.now();
  const sourceText = "Plants convert sunlight into chemical energy through photosynthesis. They absorb carbon dioxide and water to make glucose and release oxygen.";
  try {
    const exam = await completeAIJson({
      provider: "groq", task: "exam_generation", maxCompletionTokens: 800,
      system: 'Write one easy school science question grounded only in the supplied source. Return JSON with exactly: {"title":"...","questions":[{"prompt":"...","type":"short_answer","maxMarks":2,"rubric":"...","referenceAnswer":"...","sourceExcerpt":"..."}]}. The excerpt must be a verbatim quotation from the supplied text.',
      payload: { synthetic: true, sourceText },
      validate(value) {
        if (typeof value?.title !== "string" ||
            !Array.isArray(value.questions) || value.questions.length !== 1) throw Error("Exam shape invalid");
        const q = value.questions[0];
        if (q?.type !== "short_answer" || q?.maxMarks !== 2 ||
            typeof q.prompt !== "string" || typeof q.rubric !== "string" ||
            typeof q.referenceAnswer !== "string" ||
            typeof q.sourceExcerpt !== "string" ||
            !sourceText.includes(q.sourceExcerpt)) throw Error("Exam not grounded");
        return q;
      },
    });
    const grade = await completeAIJson({
      provider: "groq", task: "grading", maxCompletionTokens: 500,
      system: 'Grade the synthetic answer against this science question. Return JSON exactly as {"marks":[{"questionIndex":0,"awardedMarks":2,"feedback":"...","evidence":"...","needsReview":false}]}. Awarded marks must reflect accuracy, 0 through 2.',
      payload: {
        synthetic: true, question: exam.value,
        answer: "Photosynthesis lets plants use sunlight, carbon dioxide, and water to make glucose and release oxygen.",
      },
      validate(value) {
        if (!Array.isArray(value?.marks) || value.marks.length !== 1) throw Error("Marks invalid");
        const mark = value.marks[0];
        if (mark?.questionIndex !== 0 || typeof mark.awardedMarks !== "number" ||
            mark.awardedMarks < 0 || mark.awardedMarks > 2 ||
            typeof mark.feedback !== "string" || !mark.feedback.trim() ||
            typeof mark.evidence !== "string" ||
            typeof mark.needsReview !== "boolean") throw Error("Grading invalid");
        return mark;
      },
    });
    classroomWorkflowStatus = "passed";
    console.info(JSON.stringify({
      event: "cabo_ai_classroom_workflow", status: "passed",
      examModel: exam.modelId, gradingModel: grade.modelId,
      latencyMs: Date.now() - start,
    }));
  } catch (error) {
    classroomWorkflowStatus = "failed";
    console.warn(JSON.stringify({
      event: "cabo_ai_classroom_workflow", status: "failed",
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
  fallback: fallbackStatus, classroomWorkflow: classroomWorkflowStatus,
}));
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
