import { and, asc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  db, accountabilityCasesTable, accountabilityCaseEventsTable,
  organizationMembersTable, managementRoleGrantsTable,
} from "@workspace/db";
import {
  LEVELS, deadlines, effectiveRank, effectiveSeverity, escalationDecision, initialLevel, regulatorDeadline,
  type CaseKind, type Severity, type CaseStatus,
} from "./accountabilityPolicy";
import { regimeForOrganization } from "./schoolMembership";
import { logger } from "./logger";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

/**
 * Pick the accountable owner for a level: a member whose rank meets the level,
 * with the fewest open cases, nearest the level's rank (so routine cases do
 * not all land on the head), never the person the case is about.
 */
export async function chooseOwner(exec: Executor, organizationId: number, level: number, exclude: readonly string[]): Promise<string | null> {
  const minRank = LEVELS[Math.min(level, LEVELS.length - 1)].minRank;
  const [members, grants, open] = await Promise.all([
    exec.select({ userId: organizationMembersTable.userId, role: organizationMembersTable.role }).from(organizationMembersTable)
      .where(eq(organizationMembersTable.organizationId, organizationId)).limit(2000),
    exec.select({ userId: managementRoleGrantsTable.userId, role: managementRoleGrantsTable.role }).from(managementRoleGrantsTable)
      .where(eq(managementRoleGrantsTable.organizationId, organizationId)).limit(2000),
    exec.select({ assignedTo: accountabilityCasesTable.assignedTo, n: sql<number>`count(*)::int` }).from(accountabilityCasesTable)
      .where(and(eq(accountabilityCasesTable.organizationId, organizationId), inArray(accountabilityCasesTable.status, ["open", "acknowledged", "in_progress"]), isNotNull(accountabilityCasesTable.assignedTo)))
      .groupBy(accountabilityCasesTable.assignedTo),
  ]);
  const people = new Map<string, { orgRole: string | null; grants: string[] }>();
  for (const m of members) people.set(m.userId, { orgRole: m.role, grants: [] });
  for (const g of grants) {
    const p = people.get(g.userId);
    if (p) p.grants.push(g.role); // grants only count for current members of the school
  }
  const load = new Map(open.map(o => [o.assignedTo!, Number(o.n)]));
  const candidates = [...people.entries()]
    .filter(([userId]) => !exclude.includes(userId))
    .map(([userId, p]) => ({ userId, rank: effectiveRank({ userId, orgRole: p.orgRole, grants: p.grants }) }))
    .filter(c => c.rank >= minRank)
    .sort((a, b) => (load.get(a.userId) ?? 0) - (load.get(b.userId) ?? 0) || a.rank - b.rank || a.userId.localeCompare(b.userId));
  return candidates[0]?.userId ?? null;
}

export async function recordEvent(exec: Executor, e: {
  caseId: number; organizationId: number; actorId: string | null; action: string; note?: string; fromLevel?: number | null; toLevel?: number | null;
}) {
  await exec.insert(accountabilityCaseEventsTable).values({
    caseId: e.caseId, organizationId: e.organizationId, actorId: e.actorId, action: e.action,
    note: (e.note ?? "").slice(0, 2000), fromLevel: e.fromLevel ?? null, toLevel: e.toLevel ?? null,
  });
}

export async function openCase(input: {
  organizationId: number; kind: CaseKind; severity: Severity; summary: string;
  reporterId: string | null; subjectUserId?: string | null; sourceMessageId?: number | null; awareAt?: Date;
}, exec: Executor = db) {
  const now = new Date();
  const awareAt = input.awareAt && input.awareAt <= now ? input.awareAt : now;
  const severity = effectiveSeverity(input.kind, input.severity);
  const level = initialLevel(input.kind, severity);
  const regime = await regimeForOrganization(input.organizationId);
  const due = deadlines(severity, now);
  const exclude = [input.subjectUserId ?? ""].filter(Boolean);
  const run = async (tx: Executor) => {
    const owner = await chooseOwner(tx, input.organizationId, level, exclude);
    const [row] = await tx.insert(accountabilityCasesTable).values({
      organizationId: input.organizationId, kind: input.kind, severity, status: "open",
      summary: input.summary, reporterId: input.reporterId, subjectUserId: input.subjectUserId ?? null,
      assignedTo: owner, escalationLevel: level, jurisdiction: regime.code, awareAt,
      acknowledgeDueAt: due.acknowledgeDueAt, resolveDueAt: due.resolveDueAt,
      regulatorDueAt: regulatorDeadline(input.kind, regime, awareAt), sourceMessageId: input.sourceMessageId ?? null,
    }).returning();
    await recordEvent(tx, { caseId: row.id, organizationId: row.organizationId, actorId: input.reporterId, action: "created", toLevel: level, note: `${input.kind} · ${severity}` });
    await recordEvent(tx, { caseId: row.id, organizationId: row.organizationId, actorId: null, action: owner ? "assigned" : "no_owner", toLevel: level, note: owner ?? `No member at level ${level} (${LEVELS[level].title})` });
    return row;
  };
  return exec === db ? db.transaction(tx => run(tx)) : run(exec);
}

/**
 * Escalate every overdue case of one school (or all schools). Each change is
 * conditional on the row still being in the state that was read, so two
 * sweeps never escalate the same miss twice.
 */
export async function sweepOverdue(organizationId?: number, now = new Date()): Promise<number> {
  const overdue = await db.select().from(accountabilityCasesTable).where(and(
    organizationId ? eq(accountabilityCasesTable.organizationId, organizationId) : undefined,
    inArray(accountabilityCasesTable.status, ["open", "acknowledged", "in_progress"]),
    or(
      and(eq(accountabilityCasesTable.status, "open"), lte(accountabilityCasesTable.acknowledgeDueAt, now)),
      lte(accountabilityCasesTable.resolveDueAt, now),
    ),
  )).orderBy(asc(accountabilityCasesTable.id)).limit(500);
  let changed = 0;
  for (const c of overdue) {
    const decision = escalationDecision({
      status: c.status as CaseStatus, severity: c.severity as Severity, escalationLevel: c.escalationLevel,
      acknowledgeDueAt: c.acknowledgeDueAt, resolveDueAt: c.resolveDueAt,
    }, now);
    if (decision.action === "none") continue;
    try {
      await db.transaction(async tx => {
        if (decision.action === "overdue_at_top") {
          // Record the miss once per deadline at the top level, then extend the
          // window by the severity's acknowledgement time so it is re-flagged
          // if still untouched, without flooding the log.
          const fresh = deadlines(c.severity as Severity, now);
          const updated = await tx.update(accountabilityCasesTable).set({
            ...(decision.reason === "acknowledgement_overdue" ? { acknowledgeDueAt: fresh.acknowledgeDueAt } : { resolveDueAt: fresh.acknowledgeDueAt }),
            updatedAt: now,
          }).where(and(eq(accountabilityCasesTable.id, c.id), eq(accountabilityCasesTable.escalationLevel, c.escalationLevel), eq(accountabilityCasesTable.status, c.status)))
            .returning({ id: accountabilityCasesTable.id });
          if (!updated.length) return;
          await recordEvent(tx, { caseId: c.id, organizationId: c.organizationId, actorId: null, action: "overdue_at_top", note: `${decision.reason}; owner ${c.assignedTo ?? "none"}`, fromLevel: c.escalationLevel, toLevel: c.escalationLevel });
          changed++;
          return;
        }
        const owner = await chooseOwner(tx, c.organizationId, decision.toLevel, [c.subjectUserId ?? ""].filter(Boolean));
        const updated = await tx.update(accountabilityCasesTable).set({
          escalationLevel: decision.toLevel, assignedTo: owner ?? c.assignedTo,
          acknowledgeDueAt: decision.acknowledgeDueAt, resolveDueAt: decision.resolveDueAt,
          // A new owner must acknowledge again.
          status: c.status === "acknowledged" ? "open" : c.status, updatedAt: now,
        }).where(and(eq(accountabilityCasesTable.id, c.id), eq(accountabilityCasesTable.escalationLevel, c.escalationLevel), eq(accountabilityCasesTable.status, c.status)))
          .returning({ id: accountabilityCasesTable.id });
        if (!updated.length) return;
        await recordEvent(tx, { caseId: c.id, organizationId: c.organizationId, actorId: null, action: "escalated", note: `${decision.reason}; missed by ${c.assignedTo ?? "no owner"}`, fromLevel: c.escalationLevel, toLevel: decision.toLevel });
        await recordEvent(tx, { caseId: c.id, organizationId: c.organizationId, actorId: null, action: owner ? "assigned" : "no_owner", toLevel: decision.toLevel, note: owner ?? `No member at level ${decision.toLevel} (${LEVELS[decision.toLevel].title})` });
        changed++;
      });
    } catch (error) {
      logger.warn({ caseId: c.id, err: error instanceof Error ? error.name : "unknown" }, "accountability escalation skipped");
    }
  }
  return changed;
}

let timer: NodeJS.Timeout | null = null;
/** Background sweep every five minutes unless CABO_ACCOUNTABILITY_SWEEP=false. */
export function startAccountabilitySweep(env: NodeJS.ProcessEnv = process.env) {
  if (timer || env.CABO_ACCOUNTABILITY_SWEEP === "false") return;
  timer = setInterval(() => { sweepOverdue().catch(() => undefined); }, 5 * 60_000);
  timer.unref();
}
