/** Server-side, task-aware routing. Only supported chat-inference providers appear here. */
export type AiProviderName = "groq" | "huggingface" | "openai";
export type PrimaryProviderName = "groq" | "huggingface";
export type AiTask = "development_plan" | "exam_generation" | "grading" | "generic";

const taskWeights: Record<AiTask, Record<PrimaryProviderName, number>> = {
  // Interactive marking/feedback prioritises the low-latency Groq route.
  grading: { groq: 3, huggingface: 1 },
  // Longer structured generation favours HF while still using Groq.
  exam_generation: { groq: 1, huggingface: 3 },
  development_plan: { groq: 1, huggingface: 3 },
  generic: { groq: 1, huggingface: 1 },
};

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
  return groq + huggingface === 0 ? { groq: 1, huggingface: 1 } : { groq, huggingface };
}

/** Per-task weighted round robin, with the unselected provider next in line.
 * OpenAI remains an optional legacy last resort. Counters are per process, not
 * a distributed guarantee; server metrics should be used for real traffic.
 */
export function createAiProviderOrderer(weights: Record<PrimaryProviderName, number>) {
  const tickets: Record<AiTask, number> = {
    development_plan: 0, exam_generation: 0, grading: 0, generic: 0,
  };
  return (available: AiProviderName[], task: AiTask = "generic"): AiProviderName[] => {
    const active = (["groq", "huggingface"] as const).filter(name => available.includes(name));
    const enabled = active.filter(name => weights[name] > 0);
    // Start each task on its preferred provider instead of the fixed alphabetic order.
    const eligible = (enabled.length ? enabled : active).sort((a,b) =>
      weights[b] * taskWeights[task][b] - weights[a] * taskWeights[task][a]);
    const total = eligible.reduce((sum, name) => sum + weights[name] * taskWeights[task][name], 0);
    let primary: PrimaryProviderName | undefined;
    if (total > 0) {
      let position = tickets[task]++ % total;
      for (const name of eligible) {
        position -= weights[name] * taskWeights[task][name];
        if (position < 0) { primary = name; break; }
      }
    }
    return [
      ...(primary ? [primary] : []),
      ...active.filter(name => name !== primary),
      ...(available.includes("openai") ? ["openai" as const] : []),
    ];
  };
}
