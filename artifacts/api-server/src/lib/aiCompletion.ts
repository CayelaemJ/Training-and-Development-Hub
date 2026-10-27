import OpenAI from "openai";
import { logger } from "./logger";
import { createProviderScheduler, ProviderQuotaError } from "./providerQuota";
import { aiFailureAction } from "./aiRetryPolicy";
import { aiRoutingWeights, createAiProviderOrderer, type AiProviderName, type AiTask } from "./aiRouting";

type Provider = { name: AiProviderName; client: OpenAI; models: string[] };
const providerSchedulers: Record<AiProviderName, ReturnType<typeof createProviderScheduler>> = {
  groq: createProviderScheduler(undefined, undefined, { fastFailOnQuota: true }),
  huggingface: createProviderScheduler(undefined, undefined, { fastFailOnQuota: true }),
  openai: createProviderScheduler(undefined, undefined, { fastFailOnQuota: true }),
};
const orderProviders = createAiProviderOrderer(aiRoutingWeights(process.env));
const blockedUntil: Record<AiProviderName, number> = { groq: 0, huggingface: 0, openai: 0 };

export class AiUnavailableError extends Error {
  constructor() {
    super("AI generation is temporarily unavailable. Please try again shortly; no work has been submitted.");
    this.name = "AiUnavailableError";
  }
}

export function hasAiProvider(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim() || process.env.HF_TOKEN?.trim() ||
    process.env.HUGGINGFACE_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
}

const groqModelCache: { expires: number; models: string[] | null } = { expires: 0, models: null };
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const HF_BASE_URL = "https://router.huggingface.co/v1";
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
    const response = await client.models.list({ timeout: 5000 });
    const models = response.data.map(model => model.id);
    groqModelCache.models = models;
    groqModelCache.expires = Date.now() + 5 * 60_000;
    return models;
  } catch (error) {
    groqModelCache.models = null;
    groqModelCache.expires = Date.now() + 60_000;
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
  const hfToken = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_API_KEY?.trim();
  if (hfToken) {
    const client = new OpenAI({ apiKey: hfToken, baseURL: HF_BASE_URL, timeout: 25_000, maxRetries: 0 });
    // Inference Providers supports the OpenAI-compatible chat endpoint. The model
    // can be changed without a code deployment when access or pricing changes.
    providers.push({
      name: "huggingface",
      client,
      models: cleanModels([process.env.HF_CHAT_MODEL || "openai/gpt-oss-120b:cheapest"]).slice(0, 2),
    });
  }
  if (process.env.OPENAI_API_KEY?.trim()) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim(), timeout: 25_000, maxRetries: 0 });
    providers.push({ name: "openai", client, models: cleanModels([process.env.OPENAI_EXAM_MODEL, "gpt-4.1-mini", "gpt-4o-mini"]).slice(0, 3) });
  }
  return providers;
}

function jsonFromAnswer(content: string): unknown {
  const trimmed = content.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "").trim();
  try { return JSON.parse(trimmed) as unknown; } catch { /* A provider may prepend an explanation. */ }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Provider did not return JSON");
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

function postponeProvider(name: AiProviderName, ms: number): void {
  blockedUntil[name] = Math.max(blockedUntil[name], Date.now() + ms);
}

/**
 * Validate the output before committing any caller-side state. Production
 * traffic is split between Groq and HF, with failover and optional OpenAI
 * legacy fallback. A provider override is only for admin smoke tests.
 */
export async function completeAIJson<T>(args: {
  system: string;
  payload: unknown;
  validate: (value: unknown) => T;
  maxCompletionTokens?: number;
  provider?: AiProviderName;
  task?: AiTask;
}): Promise<{ value: T; modelId: string; provider: AiProviderName }> {
  const deadline = Date.now() + 180_000;
  let quotaError: ProviderQuotaError | undefined;
  const configured = await configuredProviders();
  const order = args.provider ? [args.provider] : orderProviders(configured.map(item => item.name), args.task);
  const providers = order.flatMap(name => configured.filter(candidate => candidate.name === name));
  if (!providers.length) throw new AiUnavailableError();
  providers: for (const provider of providers) {
    const remainingCooldown = blockedUntil[provider.name] - Date.now();
    if (remainingCooldown > 0) {
      if (remainingCooldown >= 1000) quotaError ??= new ProviderQuotaError(remainingCooldown / 1000);
      continue;
    }
    for (const model of provider.models) {
      for (const jsonMode of [true, false]) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new AiUnavailableError();
        try {
          const response = await providerSchedulers[provider.name](() => provider.client.chat.completions.create({
            model,
            messages: [
              { role: "system", content: args.system + " Return exactly one valid JSON object. No markdown and no extra text." },
              { role: "user", content: JSON.stringify(args.payload) },
            ],
            ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
            ...(provider.name === "groq" && model.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low" as const } : {}),
            ...(provider.name === "huggingface" ? { max_tokens: args.maxCompletionTokens ?? 3500 } : { max_completion_tokens: args.maxCompletionTokens ?? 3500 }),
          }, { timeout: Math.min(25_000, Math.max(1, deadline - Date.now())), signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) }), deadline);
          const body = response.choices[0]?.message?.content;
          if (!body) throw new Error("Empty completion");
          const parsed = args.validate(jsonFromAnswer(body));
          logger.info({ provider: provider.name, model }, "CABO AI completion validated");
          return { value: parsed, modelId: model, provider: provider.name };
        } catch (error) {
          if (error instanceof ProviderQuotaError) {
            quotaError = error;
            postponeProvider(provider.name, error.retryAfterSeconds * 1000);
            continue providers;
          }
          const err = error as { status?: number; code?: string; name?: string };
          logger.warn({ provider: provider.name, model, jsonMode, status: err.status ?? null, code: err.code ?? null, type: err.name ?? "Error" }, "CABO AI candidate did not return valid output");
          const action = aiFailureAction(err, jsonMode);
          if (action === "next-provider") {
            // Circuit breaker avoids repeatedly selecting an unhealthy provider.
            postponeProvider(provider.name, err.status === 401 || err.status === 403 ? 300_000 : err.status === 429 ? 60_000 : 30_000);
            continue providers;
          }
          if (action === "next-model") break;
        }
      }
    }
  }
  throw quotaError ?? new AiUnavailableError();
}
