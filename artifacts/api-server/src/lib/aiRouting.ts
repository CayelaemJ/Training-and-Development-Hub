/** Routing decisions only; credentials and inference stay on the server. */
export type AiProviderName = "groq" | "huggingface" | "openai";
export type PrimaryProviderName = "groq" | "huggingface";

/** Invalid or extreme weights cannot create unbounded scheduling tables. */
export function aiWeight(value: string | undefined, fallback = 1): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100 ? parsed : fallback;
}

export function aiRoutingWeights(env: {
  CABO_AI_GROQ_WEIGHT?: string;
  CABO_AI_HF_WEIGHT?: string;
}): Record<PrimaryProviderName, number> {
  const groq = aiWeight(env.CABO_AI_GROQ_WEIGHT);
  const huggingface = aiWeight(env.CABO_AI_HF_WEIGHT);
  // Do not accidentally disable both providers.
  return groq + huggingface === 0 ? { groq: 1, huggingface: 1 } : { groq, huggingface };
}

/**
 * Select an initial provider by weighted round robin, then return alternatives
 * for failure recovery. OpenAI is retained as a legacy fallback, not in the
 * primary traffic split. Counts are per process; no cross-instance guarantee.
 */
export function createAiProviderOrderer(weights: Record<PrimaryProviderName, number>) {
  let ticket = 0;
  return (available: AiProviderName[]): AiProviderName[] => {
    const active = (["groq", "huggingface"] as const)
      .filter(name => available.includes(name));
    const enabled = active.filter(name => weights[name] > 0);
    const eligible = enabled.length ? enabled : active;
    const total = eligible.reduce((sum, name) => sum + (weights[name] || 1), 0);
    let primary: PrimaryProviderName | undefined;
    if (total > 0) {
      let position = ticket++ % total;
      for (const name of eligible) {
        position -= weights[name] || 1;
        if (position < 0) { primary = name; break; }
      }
    }
    const others = active.filter(name => name !== primary);
    return [
      ...(primary ? [primary] : []),
      ...others,
      ...(available.includes("openai") ? ["openai" as const] : []),
    ];
  };
}
