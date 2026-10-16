import { logger } from "./logger";
import { completeAIJson, hasAiProvider } from "./aiCompletion";

const demoSource = "Photosynthesis is the process by which green plants convert sunlight into chemical energy. Plants absorb carbon dioxide through their leaves and water through their roots. Using sunlight, they produce glucose and release oxygen into the atmosphere. Chlorophyll in the leaves absorbs the light energy needed for this process.";

/** One-shot synthetic exam-generation + AI-marking smoke test; testing only, no real learner data. */
export async function groqSmokeTest(): Promise<void> {
  if (process.env.RAILWAY_ENVIRONMENT_NAME !== "testing" || process.env.CABO_GROQ_SMOKE_TEST !== "true") return;
  if (!hasAiProvider()) {
    logger.error("CABO AI workflow smoke FAILED: no provider configured");
    return;
  }
  try {
    const exam = await completeAIJson({
      system: "Create a ONE-question classroom written exam from source text only. Respond with a JSON object {title,questions:[{prompt,type,maxMarks,rubric,referenceAnswer,sourceExcerpt}]}. type must be short_answer, maxMarks 2, sourceExcerpt must be an EXACT quote from source text. Every text value must be at least ten characters.",
      payload: { sourceText: demoSource, questionCount: 1, difficulty: "beginner" },
      maxCompletionTokens: 850,
      validate(value) {
        const v = value as { title?: unknown; questions?: Array<Record<string, unknown>> };
        if (typeof v?.title !== "string" || !Array.isArray(v.questions) || v.questions.length !== 1) throw Error("Invalid exam");
        const q = v.questions[0];
        if (typeof q.prompt !== "string" || typeof q.sourceExcerpt !== "string" ||
          !demoSource.includes(q.sourceExcerpt) || typeof q.referenceAnswer !== "string" ||
          typeof q.rubric !== "string" || q.maxMarks !== 2 || q.type !== "short_answer") throw Error("Ungrounded exam");
        return { title: v.title, question: q };
      },
    });
    const grading = await completeAIJson({
      system: "Grade the learner answer against the question. Reply with JSON {marks:[{questionIndex,awardedMarks,feedback,evidence,needsReview}]}. Marks 0 to 2, questionIndex must be 0, feedback and evidence must be strings, needsReview must be boolean.",
      payload: { question: exam.value.question, answer: "Plants use sunlight, carbon dioxide and water to make glucose, giving off oxygen." },
      maxCompletionTokens: 550,
      validate(value) {
        const v = value as { marks?: Array<{ questionIndex?: unknown; awardedMarks?: unknown; feedback?: unknown; evidence?: unknown; needsReview?: unknown }> };
        if (!Array.isArray(v?.marks) || v.marks.length !== 1) throw Error("Invalid marks");
        const mark = v.marks[0];
        if (mark.questionIndex !== 0 || typeof mark.awardedMarks !== "number" ||
          mark.awardedMarks < 0 || mark.awardedMarks > 2 || typeof mark.feedback !== "string" ||
          typeof mark.evidence !== "string" || typeof mark.needsReview !== "boolean") throw Error("Invalid grading");
        return mark;
      },
    });
    logger.info({ generationModel: exam.modelId, markingModel: grading.modelId }, "CABO AI workflow smoke PASSED");
  } catch (error) {
    logger.error({ errorType: error instanceof Error ? error.name : "Error" }, "CABO AI workflow smoke FAILED");
  }
}
