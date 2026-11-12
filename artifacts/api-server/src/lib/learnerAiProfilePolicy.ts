import { z } from "zod/v4";

const learnerText = z.string().trim().min(2).max(120);
export const learnerAiProfileInput = z.object({
  personalizationEnabled: z.boolean(),
  goals: z.array(learnerText).max(8),
  interests: z.array(learnerText).max(12),
  preferredLanguage: z.string().trim().max(24),
  explanationStyle: z.enum(["step_by_step", "examples_first", "concise", "practice_first", "visual"]),
  learningPreferences: z.array(z.enum(["short_sessions", "worked_examples", "plain_language", "practice_questions", "visual_aids", "check_understanding"])).max(6),
}).strict();

export const emptyLearnerAiProfile = {
  personalizationEnabled: false,
  goals: [] as string[],
  interests: [] as string[],
  preferredLanguage: "",
  explanationStyle: "step_by_step" as const,
  learningPreferences: [] as string[],
};
