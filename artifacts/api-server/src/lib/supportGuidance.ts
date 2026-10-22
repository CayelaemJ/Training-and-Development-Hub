export function supportGuidanceTemplate(concept: string) {
  return {
    source: "non_ai_template" as const,
    explanation: `Break ${concept} into one small learning step. First explain what you already know, then work through a simple example with your educator.`,
    questions: [
      "Which step can you explain in your own words?",
      "Where does your method stop making sense?",
      "Can you check your answer using a different example?",
    ],
    practice: [
      "Try one worked example with guidance.",
      "Try a similar question independently and explain each step.",
      "Ask your educator to check your reasoning before increasing difficulty.",
    ],
    reviewRequired: true,
  };
}
export function safeEducationalTopic(topic: string) {
  return (
    topic.length >= 2 &&
    topic.length <= 160 &&
    !/@|https?:|\b\d{6,}\b|ignore.{0,30}instructions|system prompt/i.test(topic)
  );
}
