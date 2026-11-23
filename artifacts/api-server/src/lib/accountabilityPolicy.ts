/**
 * Accountability and escalation rules.
 *
 * Every case has one accountable owner at a time, an acknowledgement deadline
 * and a resolution deadline set by severity. When a deadline passes without
 * the required action, the case moves automatically up the school's chain of
 * responsibility and the miss is recorded against the case permanently, so
 * response times can be reviewed per person. Data incidents also carry the
 * regulator-notification clock of the school's country (see jurisdictionPolicy).
 *
 * Safeguarding concerns are never disclosed automatically to guardians or to
 * the learner concerned; trained staff decide what to share.
 */
import { addHours, type PrivacyRegime } from "./jurisdictionPolicy";
import { leadershipRanks, type HierarchyRole } from "./hierarchyPolicy";

export const CASE_KINDS = ["safeguarding", "conduct", "data_incident", "chat_report", "service"] as const;
export type CaseKind = (typeof CASE_KINDS)[number];
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const STATUSES = ["open", "acknowledged", "in_progress", "resolved", "closed"] as const;
export type CaseStatus = (typeof STATUSES)[number];

/** Hours to acknowledge and to resolve, by severity. CABO internal service levels. */
export const SLA_HOURS: Readonly<Record<Severity, { acknowledge: number; resolve: number }>> = {
  critical: { acknowledge: 1, resolve: 24 },
  high: { acknowledge: 4, resolve: 72 },
  medium: { acknowledge: 24, resolve: 7 * 24 },
  low: { acknowledge: 72, resolve: 14 * 24 },
};

/** Minimum management rank that can own or see a case at each escalation level. */
export const LEVELS = [
  { level: 0, title: "Designated staff lead", minRank: leadershipRanks.grade_head },
  { level: 1, title: "School leadership (head or deputy)", minRank: leadershipRanks.deputy_headmaster },
  { level: 2, title: "Governing body or district office", minRank: leadershipRanks.governing_body_chair },
] as const;
export const MAX_LEVEL = LEVELS.length - 1;

/** Safeguarding and data incidents start at school leadership when serious. */
export function initialLevel(kind: CaseKind, severity: Severity): number {
  if ((kind === "safeguarding" || kind === "data_incident") && (severity === "high" || severity === "critical")) return 1;
  return 0;
}

/** Severity floor for kinds that must never be filed as low. */
export function effectiveSeverity(kind: CaseKind, severity: Severity): Severity {
  if (kind === "safeguarding" && severity === "low") return "medium";
  if (kind === "data_incident" && (severity === "low" || severity === "medium")) return "high";
  return severity;
}

export type MemberContext = {
  userId: string;
  orgRole: string | null;
  grants: readonly string[];
  superadmin?: boolean;
};

/** A member's effective management rank inside one school. */
export function effectiveRank(m: MemberContext): number {
  let rank = 0;
  if (m.orgRole === "owner" || m.orgRole === "admin") rank = leadershipRanks.headmaster;
  else if (m.orgRole === "teacher" || m.orgRole === "assessor") rank = leadershipRanks.teacher;
  for (const g of m.grants) {
    const r = (leadershipRanks as Record<string, number>)[g as HierarchyRole];
    if (typeof r === "number" && r > rank) rank = r;
  }
  return rank;
}

/** Who may raise which kind of case. */
export function mayRaise(kind: CaseKind, m: MemberContext & { verifiedGuardian?: boolean }): boolean {
  const member = m.orgRole !== null;
  if (kind === "data_incident" || kind === "service") return effectiveRank(m) >= leadershipRanks.teacher || !!m.superadmin;
  if (kind === "chat_report") return false; // created only by the chat report flow
  return member || !!m.verifiedGuardian || !!m.superadmin;
}

export type CaseView = "full" | "reporter" | "none";

export type CaseFacts = {
  reporterId: string | null;
  assignedTo: string | null;
  subjectUserId: string | null;
  escalationLevel: number;
};

/**
 * Handlers at or above the case's current level see everything, and so does
 * the current owner. The reporter sees only status and deadlines. The person
 * the case is about sees nothing through this path.
 */
export function caseView(viewer: MemberContext, c: CaseFacts): CaseView {
  if (viewer.superadmin) return "full";
  const level = LEVELS[Math.min(Math.max(c.escalationLevel, 0), MAX_LEVEL)];
  if (c.assignedTo === viewer.userId) return "full";
  if (effectiveRank(viewer) >= level.minRank && viewer.userId !== c.subjectUserId) return "full";
  if (c.reporterId === viewer.userId) return "reporter";
  return "none";
}

/** Only someone with full view who can own the case's level may act on it. */
export function mayHandle(viewer: MemberContext, c: CaseFacts): boolean {
  if (viewer.userId === c.subjectUserId && !viewer.superadmin) return false;
  if (viewer.superadmin) return true;
  if (c.assignedTo === viewer.userId) return true;
  const level = LEVELS[Math.min(Math.max(c.escalationLevel, 0), MAX_LEVEL)];
  return effectiveRank(viewer) >= level.minRank;
}

export function deadlines(severity: Severity, from: Date) {
  const sla = SLA_HOURS[severity];
  return { acknowledgeDueAt: addHours(from, sla.acknowledge), resolveDueAt: addHours(from, sla.resolve) };
}

/** Regulator clock for data incidents only, from the moment the school became aware. */
export function regulatorDeadline(kind: CaseKind, regime: PrivacyRegime, awareAt: Date): Date | null {
  return kind === "data_incident" ? addHours(awareAt, regime.breachRegulatorHours.value) : null;
}

export type EscalationState = {
  status: CaseStatus;
  severity: Severity;
  escalationLevel: number;
  acknowledgeDueAt: Date;
  resolveDueAt: Date;
};

export type EscalationDecision =
  | { action: "none" }
  | { action: "escalate"; toLevel: number; reason: "acknowledgement_overdue" | "resolution_overdue"; acknowledgeDueAt: Date; resolveDueAt: Date }
  | { action: "overdue_at_top"; reason: "acknowledgement_overdue" | "resolution_overdue" };

/**
 * Decide what the escalation sweep does with one case at `now`. Escalating
 * gives the next level a fresh acknowledgement window and keeps at least the
 * severity's resolution window from now.
 */
export function escalationDecision(c: EscalationState, now: Date): EscalationDecision {
  if (c.status === "resolved" || c.status === "closed") return { action: "none" };
  const reason = c.status === "open" && now >= c.acknowledgeDueAt ? "acknowledgement_overdue"
    : now >= c.resolveDueAt ? "resolution_overdue" : null;
  if (!reason) return { action: "none" };
  if (c.escalationLevel >= MAX_LEVEL) return { action: "overdue_at_top", reason };
  const fresh = deadlines(c.severity, now);
  return {
    action: "escalate", toLevel: c.escalationLevel + 1, reason,
    acknowledgeDueAt: fresh.acknowledgeDueAt,
    resolveDueAt: c.resolveDueAt > fresh.resolveDueAt ? c.resolveDueAt : fresh.resolveDueAt,
  };
}

/** Allowed status changes by a handler. Closing requires a resolution first. */
export function transitionAllowed(from: CaseStatus, to: CaseStatus): boolean {
  const next: Record<CaseStatus, readonly CaseStatus[]> = {
    open: ["acknowledged", "in_progress", "resolved"],
    acknowledged: ["in_progress", "resolved"],
    in_progress: ["resolved"],
    resolved: ["closed", "in_progress"],
    closed: [],
  };
  return next[from].includes(to);
}

export type ResponseRecord = {
  assignedTo: string | null;
  createdAt: Date;
  acknowledgedAt: Date | null;
  acknowledgeDueAt: Date;
  resolvedAt: Date | null;
  resolveDueAt: Date;
  escalations: number;
};

/** Per-person response record for the accountability dashboard. */
export function responseMetrics(rows: readonly ResponseRecord[], now: Date) {
  const byPerson = new Map<string, { assigned: number; acknowledgedOnTime: number; resolvedOnTime: number; overdueNow: number; escalations: number; ackHours: number[] }>();
  for (const r of rows) {
    if (!r.assignedTo) continue;
    const m = byPerson.get(r.assignedTo) ?? { assigned: 0, acknowledgedOnTime: 0, resolvedOnTime: 0, overdueNow: 0, escalations: 0, ackHours: [] };
    m.assigned++;
    m.escalations += r.escalations;
    if (r.acknowledgedAt) {
      m.ackHours.push((r.acknowledgedAt.getTime() - r.createdAt.getTime()) / 3_600_000);
      if (r.acknowledgedAt <= r.acknowledgeDueAt) m.acknowledgedOnTime++;
    }
    if (r.resolvedAt && r.resolvedAt <= r.resolveDueAt) m.resolvedOnTime++;
    if (!r.resolvedAt && (now > r.resolveDueAt || (!r.acknowledgedAt && now > r.acknowledgeDueAt))) m.overdueNow++;
    byPerson.set(r.assignedTo, m);
  }
  return [...byPerson.entries()].map(([userId, m]) => ({
    userId,
    assigned: m.assigned,
    acknowledgedOnTime: m.acknowledgedOnTime,
    resolvedOnTime: m.resolvedOnTime,
    overdueNow: m.overdueNow,
    escalations: m.escalations,
    medianHoursToAcknowledge: m.ackHours.length
      ? Math.round([...m.ackHours].sort((a, b) => a - b)[Math.floor(m.ackHours.length / 2)] * 10) / 10
      : null,
  }));
}
