/**
 * Child progress analytics for verified guardians.
 *
 * Pure functions only (no database, no framework) so every rule is unit-tested.
 * Inputs are PUBLISHED marks only; the route never passes drafts.
 *
 * Privacy rules:
 * - Classmates' marks are only ever used in aggregate. A class comparison is
 *   shown only when at least MIN_COHORT learners (including the child) have a
 *   result for that subject and term; otherwise no comparison is returned.
 * - The class average is rounded to a whole number, and standing is reported
 *   as a band (quarter of the class), never as a rank or position.
 * - No other learner's identifier, name or mark leaves this module.
 *
 * Thresholds match the educator view (routes/academicIntelligence.ts:
 * subjects below 50% and attendance below 80% need attention) so parents and
 * teachers see the same picture.
 */

export const MIN_COHORT = 5;
export const SUBJECT_SUPPORT_BELOW = 50;
export const SUBJECT_WATCH_BELOW = 55;
export const ATTENDANCE_SUPPORT_BELOW = 80;
export const ATTENDANCE_WATCH_BELOW = 90;
export const TREND_STEP = 3; // percentage points between terms that counts as a change
export const SHARP_DECLINE = 5; // percentage points drop that moves a subject to "watch"

export type Period = { id: number; name: string };
export type MarkRow = { courseId: number; subject: string; periodId: number; marks: number; maxMarks: number; weight: number };
export type CohortMarkRow = { learnerId: string; courseId: number; periodId: number; marks: number; maxMarks: number; weight: number };
export type AttendanceDay = { day: string; status: string };
export type RecentResult = { subject: string; assessment: string; percentage: number; publishedAt: Date };

export type Trend = "improving" | "steady" | "declining" | "not_enough_data";
export type OutlookStatus = "on_track" | "watch" | "needs_support" | "not_enough_data";
export type StandingBand = "top_quarter" | "upper_middle" | "lower_middle" | "bottom_quarter";

const round1 = (n: number) => Math.round(n * 10) / 10;
const clampPct = (n: number) => Math.max(0, Math.min(100, n));

/** Weighted percentage of a set of assessment results (same rule as report cards). */
export function weightedPercentage(rows: readonly { marks: number; maxMarks: number; weight: number }[]): number | null {
  let total = 0, weights = 0;
  for (const r of rows) {
    if (!(r.maxMarks > 0) || !Number.isFinite(r.marks)) continue;
    const w = r.weight > 0 ? r.weight : 1;
    total += clampPct((r.marks / r.maxMarks) * 100) * w;
    weights += w;
  }
  return weights > 0 ? round1(total / weights) : null;
}

export function trendOf(current: number | null, previous: number | null): { change: number | null; trend: Trend } {
  if (current === null || previous === null) return { change: null, trend: "not_enough_data" };
  const change = round1(current - previous);
  return { change, trend: change >= TREND_STEP ? "improving" : change <= -TREND_STEP ? "declining" : "steady" };
}

/** Band of the class the child falls in, from the share of classmates with a lower result. */
export function standingBand(child: number, cohort: readonly number[]): StandingBand {
  const below = cohort.filter(x => x < child).length;
  const equal = cohort.filter(x => x === child).length;
  // Mid-rank percentile so ties are not pushed to either extreme.
  const percentile = ((below + 0.5 * equal) / cohort.length) * 100;
  if (percentile >= 75) return "top_quarter";
  if (percentile >= 50) return "upper_middle";
  if (percentile >= 25) return "lower_middle";
  return "bottom_quarter";
}

export function subjectOutlook(current: number | null, change: number | null): { status: OutlookStatus; reason: string } {
  if (current === null) return { status: "not_enough_data", reason: "No published results yet." };
  if (current < SUBJECT_SUPPORT_BELOW) return { status: "needs_support", reason: `Below ${SUBJECT_SUPPORT_BELOW}% in the latest term.` };
  if (change !== null && change <= -SHARP_DECLINE) return { status: "watch", reason: `Dropped ${Math.abs(change)} points since the previous term.` };
  if (current < SUBJECT_WATCH_BELOW) return { status: "watch", reason: `Close to the ${SUBJECT_SUPPORT_BELOW}% support threshold.` };
  return { status: "on_track", reason: "At or above expectations in the latest term." };
}

export function attendanceSummary(days: readonly AttendanceDay[]) {
  const attended = (d: AttendanceDay) => d.status === "present" || d.status === "late";
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const rate = (xs: AttendanceDay[]) => (xs.length ? Math.round((xs.filter(attended).length / xs.length) * 100) : null);
  const recent = sorted.slice(-20), earlier = sorted.slice(0, -20);
  const overall = rate(sorted), recentRate = rate(recent), earlierRate = rate(earlier);
  const t = trendOf(recentRate, earlierRate);
  return { recordedDays: sorted.length, rate: overall, recentRate, earlierRate, trend: t.trend };
}

export type ProgressInput = {
  periods: readonly Period[]; // ordered oldest -> newest
  childMarks: readonly MarkRow[];
  cohortMarks: readonly CohortMarkRow[]; // same school, same courses, published; includes the child
  childId: string;
  attendance: readonly AttendanceDay[];
  recentResults: readonly RecentResult[];
};

export function childProgress(input: ProgressInput) {
  const periodIndex = new Map(input.periods.map((p, i) => [p.id, i]));
  const byCourse = new Map<number, { subject: string; rows: MarkRow[] }>();
  for (const row of input.childMarks) {
    if (!periodIndex.has(row.periodId)) continue;
    const entry = byCourse.get(row.courseId) ?? { subject: row.subject, rows: [] };
    entry.rows.push(row);
    byCourse.set(row.courseId, entry);
  }

  const subjects = [...byCourse.entries()].map(([courseId, { subject, rows }]) => {
    const terms = input.periods.map(p => ({
      period: p.name,
      percentage: weightedPercentage(rows.filter(r => r.periodId === p.id)),
    }));
    const withData = input.periods.map((p, i) => ({ p, i, pct: terms[i].percentage })).filter(x => x.pct !== null);
    const latest = withData.at(-1) ?? null;
    const prior = withData.length > 1 ? withData.at(-2)! : null;
    const current = latest?.pct ?? null, previous = prior?.pct ?? null;
    const { change, trend } = trendOf(current, previous);

    // Class comparison for the latest term, aggregate only.
    let standing: { available: true; cohortSize: number; classAverage: number; band: StandingBand; differenceFromAverage: number }
      | { available: false; reason: string } = { available: false, reason: "No published results yet." };
    if (latest && current !== null) {
      const perLearner = new Map<string, CohortMarkRow[]>();
      for (const r of input.cohortMarks) {
        if (r.courseId !== courseId || r.periodId !== latest.p.id) continue;
        const list = perLearner.get(r.learnerId) ?? [];
        list.push(r);
        perLearner.set(r.learnerId, list);
      }
      const results = [...perLearner.values()].map(weightedPercentage).filter((x): x is number => x !== null);
      if (results.length < MIN_COHORT) {
        standing = { available: false, reason: `Shown only when at least ${MIN_COHORT} learners have results, to protect classmates' privacy.` };
      } else {
        const avg = results.reduce((n, x) => n + x, 0) / results.length;
        standing = {
          available: true,
          cohortSize: results.length,
          classAverage: Math.round(avg),
          band: standingBand(current, results),
          differenceFromAverage: Math.round(current - avg),
        };
      }
    }
    return {
      subject, terms, current, previous, change, trend,
      latestTerm: latest?.p.name ?? null,
      assessments: rows.length,
      standing,
      outlook: subjectOutlook(current, change),
    };
  }).sort((a, b) => a.subject.localeCompare(b.subject));

  // Overall per term = mean of subject results in that term.
  const overallTerms = input.periods.map((p, i) => {
    const vals = subjects.map(s => s.terms[i].percentage).filter((x): x is number => x !== null);
    return { period: p.name, percentage: vals.length ? round1(vals.reduce((n, x) => n + x, 0) / vals.length) : null };
  });
  const overallWithData = overallTerms.filter(t => t.percentage !== null);
  const overallCurrent = overallWithData.at(-1)?.percentage ?? null;
  const overallPrevious = overallWithData.length > 1 ? overallWithData.at(-2)!.percentage : null;
  const overallTrend = trendOf(overallCurrent, overallPrevious);

  const attendance = attendanceSummary(input.attendance);
  const statuses = subjects.map(s => s.outlook.status);
  let overall: OutlookStatus = "on_track";
  const reasons: string[] = [];
  if (subjects.length === 0) overall = "not_enough_data";
  if (statuses.includes("needs_support")) { overall = "needs_support"; reasons.push("one or more subjects are below the support threshold"); }
  if (attendance.rate !== null && attendance.rate < ATTENDANCE_SUPPORT_BELOW) { overall = "needs_support"; reasons.push(`attendance is below ${ATTENDANCE_SUPPORT_BELOW}%`); }
  if (overall !== "needs_support" && overall !== "not_enough_data") {
    if (statuses.includes("watch")) { overall = "watch"; reasons.push("one or more subjects need watching"); }
    if (attendance.rate !== null && attendance.rate < ATTENDANCE_WATCH_BELOW) { overall = "watch"; reasons.push(`attendance is below ${ATTENDANCE_WATCH_BELOW}%`); }
  }

  const improving = subjects.filter(s => s.trend === "improving").sort((a, b) => (b.change ?? 0) - (a.change ?? 0));
  const ranked = subjects.filter(s => s.current !== null).sort((a, b) => (b.current ?? 0) - (a.current ?? 0));
  return {
    overall: { current: overallCurrent, previous: overallPrevious, change: overallTrend.change, trend: overallTrend.trend, terms: overallTerms },
    outlook: { status: overall, reasons },
    subjects,
    highlights: {
      strongest: ranked.slice(0, 2).map(s => s.subject),
      mostImproved: improving.slice(0, 2).map(s => ({ subject: s.subject, change: s.change })),
      focusAreas: subjects.filter(s => s.outlook.status === "needs_support" || s.outlook.status === "watch").map(s => ({ subject: s.subject, status: s.outlook.status, reason: s.outlook.reason })),
    },
    attendance,
    recentResults: input.recentResults.slice(0, 5).map(r => ({ ...r, percentage: round1(clampPct(r.percentage)) })),
    method: {
      publishedOnly: true,
      minCohortForComparison: MIN_COHORT,
      thresholds: { subjectSupportBelow: SUBJECT_SUPPORT_BELOW, subjectWatchBelow: SUBJECT_WATCH_BELOW, attendanceSupportBelow: ATTENDANCE_SUPPORT_BELOW, attendanceWatchBelow: ATTENDANCE_WATCH_BELOW, trendStep: TREND_STEP },
      notAPrediction: "The outlook describes published results so far. It is not a forecast or an official assessment.",
    },
  };
}
