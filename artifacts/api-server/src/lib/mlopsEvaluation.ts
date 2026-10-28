/** Privacy-conscious, deterministic evaluation utilities for CABO Learning Hub.
 * Intended for held-out, human-reviewed, non-identifying assessment samples.
 * Never interpret these metrics as a learner diagnosis or promotion decision.
 */
export type GradingComparison = {
  aiMarks: number;
  educatorMarks: number;
  maximumMarks: number;
  flaggedForReview?: boolean;
};

export type GradingEvaluation = {
  sampleCount: number;
  meanAbsoluteError: number | null;
  normalizedMeanAbsoluteError: number | null;
  agreementRate: number | null;
  humanReviewRate: number | null;
  passed: boolean;
  reasons: string[];
};

export function evaluateAiMarking(
  samples: readonly GradingComparison[],
  options: { minimumSamples?: number; markTolerance?: number; maximumNormalizedError?: number } = {},
): GradingEvaluation {
  const minimumSamples = options.minimumSamples ?? 30;
  const markTolerance = options.markTolerance ?? 0.1;
  const maximumNormalizedError = options.maximumNormalizedError ?? 0.1;
  if (!Number.isInteger(minimumSamples) || minimumSamples < 1 ||
      !Number.isFinite(markTolerance) || markTolerance < 0 || markTolerance > 1 ||
      !Number.isFinite(maximumNormalizedError) || maximumNormalizedError < 0 || maximumNormalizedError > 1) {
    throw new Error("Invalid evaluation thresholds");
  }
  for (const s of samples) {
    if (![s.aiMarks, s.educatorMarks, s.maximumMarks].every(Number.isFinite) ||
        s.maximumMarks <= 0 || s.aiMarks < 0 || s.educatorMarks < 0 ||
        s.aiMarks > s.maximumMarks || s.educatorMarks > s.maximumMarks ||
        (s.flaggedForReview !== undefined && typeof s.flaggedForReview !== "boolean")) {
      throw new Error("Invalid assessment marks or maximum mark");
    }
  }
  const n = samples.length;
  const meanAbsoluteError = n ? samples.reduce((sum, s) => sum + Math.abs(s.aiMarks - s.educatorMarks), 0) / n : null;
  const normalizedMeanAbsoluteError = n ? samples.reduce((sum, s) => sum + Math.abs(s.aiMarks - s.educatorMarks) / s.maximumMarks, 0) / n : null;
  const agreementRate = n ? samples.filter(s => Math.abs(s.aiMarks - s.educatorMarks) / s.maximumMarks <= markTolerance).length / n : null;
  const humanReviewRate = n ? samples.filter(s => s.flaggedForReview).length / n : null;
  const reasons: string[] = [];
  if (n < minimumSamples) reasons.push("Insufficient human-reviewed samples");
  if (normalizedMeanAbsoluteError === null || normalizedMeanAbsoluteError > maximumNormalizedError) reasons.push("AI marks differ too much from educator marks");
  return { sampleCount: n, meanAbsoluteError, normalizedMeanAbsoluteError, agreementRate, humanReviewRate, passed: reasons.length === 0, reasons };
}
