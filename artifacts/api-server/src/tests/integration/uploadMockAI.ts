export class AiUnavailableError extends Error {}
export function hasAiProvider() {
  return true;
}
export async function completeAIJson(args: any) {
  if (Array.isArray(args.payload.excerpts)) {
    const excerpt = String(args.payload.excerpts[0] ?? "").slice(0, 120);
    return {
      value: args.validate({
        answer: "The supplied study notes explain the relevant concept.",
        citations: [{ excerpt }],
      }),
      modelId: "synthetic-test-provider",
    };
  }
  const text = args.payload.materialText ?? args.payload.text;
  const questions = Array.from(
    { length: args.payload.questionCount },
    (_, i) =>
      args.payload.optionCount
        ? {
            prompt: "Which statement is supported by this section? " + i,
            options: Array.from(
              { length: args.payload.optionCount },
              (_, j) => "Option " + j,
            ),
            correctOption: 0,
            explanation: "The source explains equivalent fractions.",
          }
        : {
            prompt: "Explain equivalent fractions in your own words.",
            type: "short_answer",
            maxMarks: 5,
            rubric: "One mark for each correct reasoning step.",
            referenceAnswer: "Equivalent fractions have the same value.",
            sourceExcerpt: text.slice(0, 60),
          },
  );
  return {
    value: args.validate({ title: "Fractions practice", questions }),
    modelId: "synthetic-test-provider",
  };
}
