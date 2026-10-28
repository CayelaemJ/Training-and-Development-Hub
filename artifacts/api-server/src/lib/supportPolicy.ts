export const supportStatuses = [
  "open",
  "triaged",
  "assigned",
  "in_progress",
  "awaiting_learner",
  "follow_up_required",
  "resolved",
  "closed",
] as const;
export type SupportStatus = (typeof supportStatuses)[number];
const next: Record<SupportStatus, readonly SupportStatus[]> = {
  open: ["triaged"],
  triaged: ["assigned"],
  assigned: ["in_progress", "triaged"],
  in_progress: ["awaiting_learner", "follow_up_required", "triaged"],
  awaiting_learner: ["in_progress", "follow_up_required"],
  follow_up_required: ["in_progress", "resolved"],
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"],
};
export function mayTransition(
  from: SupportStatus,
  to: SupportStatus,
  staff: boolean,
  owner: boolean,
  hasOutcome: boolean,
  acknowledged: boolean,
) {
  if (!next[from]?.includes(to)) return false;
  if (to === "resolved" && !hasOutcome) return false;
  if (to === "closed" && !acknowledged) return false;
  return (
    staff ||
    (owner &&
      ((from === "awaiting_learner" && to === "in_progress") ||
        (from === "resolved" && to === "closed") ||
        ((from === "closed" || from === "resolved") && to === "in_progress")))
  );
}
export function progressComparison(baseline: number, followup: number) {
  if (
    !Number.isFinite(baseline) ||
    !Number.isFinite(followup) ||
    baseline < 0 ||
    baseline > 100 ||
    followup < 0 ||
    followup > 100
  )
    throw Error("Invalid published result");
  return {
    baseline,
    followup,
    improvementPp: Math.round((followup - baseline) * 10) / 10,
  };
}
