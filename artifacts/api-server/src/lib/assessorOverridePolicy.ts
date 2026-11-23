/**
 * Effective marks for an assessed written-exam submission.
 *
 * Assessor overrides are an append-only audit trail (assessor_overrides). The
 * AI marks stored on the attempt are never modified. The effective mark for a
 * question is the most recent override for that question (latest createdAt,
 * then highest id), otherwise the AI mark. Values are clamped to the
 * question's [0, maxMarks] range defensively; the write route already rejects
 * out-of-range overrides.
 *
 * Pure functions only, so the rules are unit-tested with node:test.
 */

export type AiQuestionMark = { questionIndex: number; awardedMarks: number; maxMarks: number };
export type OverrideRecord = {
  id: number;
  questionIndex: number;
  awardedMarks: number;
  assessorId: string;
  reason: string;
  createdAt: Date;
};

export type EffectiveQuestionMark = {
  questionIndex: number;
  maxMarks: number;
  aiMarks: number;
  effectiveMarks: number;
  overridden: boolean;
  override: { id: number; awardedMarks: number; assessorId: string; reason: string; createdAt: Date } | null;
};

export type EffectiveResult = {
  questions: EffectiveQuestionMark[];
  aiAwardedMarks: number;
  effectiveAwardedMarks: number;
  maxMarks: number;
  aiPercentage: number;
  effectivePercentage: number;
  overriddenQuestions: number;
};

const clamp = (value: number, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(value, 0), Math.max(max, 0)) : 0;
const round1 = (value: number) => Math.round(value * 10) / 10;
const percentage = (awarded: number, max: number) => (max > 0 ? round1((awarded / max) * 100) : 0);

/** Most recent override per question index (later createdAt wins; ties broken by higher id). */
export function latestOverrides(overrides: readonly OverrideRecord[]): Map<number, OverrideRecord> {
  const latest = new Map<number, OverrideRecord>();
  for (const o of overrides) {
    const current = latest.get(o.questionIndex);
    if (
      !current ||
      o.createdAt.getTime() > current.createdAt.getTime() ||
      (o.createdAt.getTime() === current.createdAt.getTime() && o.id > current.id)
    ) {
      latest.set(o.questionIndex, o);
    }
  }
  return latest;
}

export function effectiveMarks(
  feedback: readonly AiQuestionMark[],
  overrides: readonly OverrideRecord[],
): EffectiveResult {
  const latest = latestOverrides(overrides);
  const questions = feedback.map((q): EffectiveQuestionMark => {
    const max = Number.isFinite(q.maxMarks) ? Math.max(q.maxMarks, 0) : 0;
    const ai = clamp(q.awardedMarks, max);
    const o = latest.get(q.questionIndex) ?? null;
    return {
      questionIndex: q.questionIndex,
      maxMarks: max,
      aiMarks: ai,
      effectiveMarks: o ? clamp(o.awardedMarks, max) : ai,
      overridden: o !== null,
      override: o
        ? { id: o.id, awardedMarks: clamp(o.awardedMarks, max), assessorId: o.assessorId, reason: o.reason, createdAt: o.createdAt }
        : null,
    };
  });
  // Overrides for question indexes that are not in the feedback are ignored.
  const maxMarks = questions.reduce((n, q) => n + q.maxMarks, 0);
  const aiAwardedMarks = round1(questions.reduce((n, q) => n + q.aiMarks, 0));
  const effectiveAwardedMarks = round1(questions.reduce((n, q) => n + q.effectiveMarks, 0));
  return {
    questions,
    aiAwardedMarks,
    effectiveAwardedMarks,
    maxMarks,
    aiPercentage: percentage(aiAwardedMarks, maxMarks),
    effectivePercentage: percentage(effectiveAwardedMarks, maxMarks),
    overriddenQuestions: questions.filter(q => q.overridden).length,
  };
}

/** Mean of effective percentages; null when there are no submissions. */
export function averageEffectivePercentage(results: readonly Pick<EffectiveResult, "effectivePercentage">[]): number | null {
  if (results.length === 0) return null;
  return round1(results.reduce((n, r) => n + r.effectivePercentage, 0) / results.length);
}
