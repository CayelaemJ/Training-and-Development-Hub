import OpenAI from "openai";
import { logger } from "./logger";

/**
 * One-shot, test-environment-only Groq credential and JSON-response smoke check.
 * Never logs the API key, model output, request body, or any learner content.
 */
export async function groqSmokeTest(): Promise<void> {
  if (process.env.RAILWAY_ENVIRONMENT_NAME !== "testing" || process.env.CABO_GROQ_SMOKE_TEST !== "true") return;
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    logger.error("CABO Groq smoke test FAILED: GROQ_API_KEY missing");
    return;
  }
  const model = process.env.GROQ_EXAM_MODEL || "llama-3.3-70b-versatile";
  const client = new OpenAI({
    apiKey: key,
    baseURL: "https://api.groq.com/openai/v1",
    timeout: 20_000,
    maxRetries: 0,
  });
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Reply with only a JSON object containing an ok boolean." },
        { role: "user", content: "Return a JSON object with ok set to true." },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 32,
    });
    const body = response.choices[0]?.message?.content || "";
    const parsed: unknown = JSON.parse(body);
    const valid = Boolean(parsed && typeof parsed === "object" && "ok" in parsed && (parsed as {ok:unknown}).ok === true);
    if (!valid) throw new Error("Model returned unexpected JSON structure");
    logger.info({ model, responseIdPresent: Boolean(response.id) }, "CABO Groq smoke test PASSED");
  } catch (error) {
    const err = error as { status?: number; code?: string; name?: string };
    logger.error({ model, status: err.status ?? null, code: err.code ?? null, errorType: err.name ?? "Error" },
      "CABO Groq smoke test FAILED");
  }
}
