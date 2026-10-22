import OpenAI from "openai";
import { logger } from "./logger";
import { aiFailureAction } from "./aiRetryPolicy";

type AiProvider = "groq" | "openai";
type Provider = { name: AiProvider; client: OpenAI; models: string[] };

export class AiUnavailableError extends Error {
  constructor() {
    super("AI generation is temporarily unavailable. Please try again shortly; no work has been submitted.");
    this.name = "AiUnavailableError";
  }
}

export function hasAiProvider(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
}

const groqModelCache: { expires: number; models: string[] | null } = { expires: 0, models: null };
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MODEL_NOT_CHAT = /whisper|tts|speech|audio|playai|guard|safeguard|transcri|embedding|vision/i;

function cleanModels(names: Array<string | undefined>, available?: string[] | null): string[] {
  const seen = new Set<string>();
  return names.filter((name): name is string => Boolean(name?.trim()))
    .map(name => name.trim())
    .filter(name => !MODEL_NOT_CHAT.test(name))
    .filter(name => !available || available.includes(name))
    .filter(name => { if (seen.has(name)) return false; seen.add(name); return true; });
}

async function groqModels(client: OpenAI): Promise<string[] | null> {
  if (Date.now() < groqModelCache.expires) return groqModelCache.models;
  try {
    const response = await client.models.list({timeout:5000});
    const models = response.data.map(model => model.id);
    groqModelCache.models = models;
    groqModelCache.expires = Date.now() + 5 * 60_000;
    return models;
  } catch (error) {
    const code = error as { status?: number; code?: string };
    logger.warn({ provider: "groq", status: code.status ?? null, code: code.code ?? null }, "Groq model discovery unavailable");
    return null;
  }
}

async function configuredProviders(): Promise<Provider[]> {
  const providers: Provider[] = [];
  if (process.env.GROQ_API_KEY?.trim()) {
    const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY.trim(), baseURL: GROQ_BASE_URL, timeout: 25_000, maxRetries: 0 });
    const discovered = await groqModels(client);
    const candidates = cleanModels([
      process.env.GROQ_EXAM_MODEL,
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-20b",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      ...(discovered ?? []),
    ], discovered);
    if (candidates.length) providers.push({ name: "groq", client, models: candidates.slice(0, 5) });
  }
  if (process.env.OPENAI_API_KEY?.trim()) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim(), timeout: 25_000, maxRetries: 0 });
    providers.push({ name: "openai", client, models: cleanModels([process.env.OPENAI_EXAM_MODEL, "gpt-4.1-mini", "gpt-4o-mini"]).slice(0, 3) });
  }
  return providers;
}

function jsonFromAnswer(content: string): unknown {
  const trimmed = content.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "").trim();
  try { return JSON.parse(trimmed) as unknown; } catch { /* Some providers wrap a JSON object in an explanation. */ }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Provider did not return JSON");
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

/** Tries accessible Groq models and then OpenAI when configured. Validates every response before accepting it. */
export async function completeAIJson<T>(args: {
  system: string;
  payload: unknown;
  validate: (value: unknown) => T;
  maxCompletionTokens?: number;
}): Promise<{ value: T; modelId: string }> {
  const deadline=Date.now()+45000;
  const providers = await configuredProviders();
  if (!providers.length) throw new AiUnavailableError();
  providers: for (const provider of providers) {
    for (const model of provider.models) {
      for (const jsonMode of [true, false]) {
        const remaining=deadline-Date.now();
        if(remaining<=0)throw new AiUnavailableError();
        try {
          const response = await provider.client.chat.completions.create({
            model,
            messages: [
              { role: "system", content: args.system + " Return exactly one valid JSON object. No markdown and no extra text." },
              { role: "user", content: JSON.stringify(args.payload) },
            ],
            ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
            ...(provider.name === "groq" && model.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low" as const } : {}),
            max_completion_tokens: args.maxCompletionTokens ?? 3500,
          },{timeout:Math.min(15000,remaining),signal:AbortSignal.timeout(remaining)});
          const body = response.choices[0]?.message?.content;
          if (!body) throw new Error("Empty completion");
          const parsed = args.validate(jsonFromAnswer(body));
          logger.info({ provider: provider.name, model }, "CABO AI completion validated");
          return { value: parsed, modelId: model };
        } catch (error) {
          const err = error as { status?: number; code?: string; name?: string };
          // Retrying without JSON mode is useful for models that do not implement response_format.
          logger.warn({ provider: provider.name, model, jsonMode, status: err.status ?? null, code: err.code ?? null, type: err.name ?? "Error" }, "CABO AI candidate did not return valid output");
          const action = aiFailureAction(err, jsonMode);
          if (action === "next-provider") continue providers;
          if (action === "next-model") break;
        }
      }
    }
  }
  throw new AiUnavailableError();
}
