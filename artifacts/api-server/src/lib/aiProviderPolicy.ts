export type AiProviderConfiguration = {
  configured: boolean;
  preferredProvider: "groq" | "none";
  developmentModel: string;
};

export function aiProviderConfiguration(environment: NodeJS.ProcessEnv = process.env): AiProviderConfiguration {
  const configured = Boolean(environment.GROQ_API_KEY?.trim());
  return {
    configured,
    preferredProvider: configured ? "groq" : "none",
    developmentModel: environment.GROQ_EXAM_MODEL?.trim() || "openai/gpt-oss-120b",
  };
}

export function groqApiKey(environment: NodeJS.ProcessEnv = process.env): string | null {
  return environment.GROQ_API_KEY?.trim() || null;
}
