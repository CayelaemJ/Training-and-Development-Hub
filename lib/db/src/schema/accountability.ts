import { index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./auth";

// Accountability cases: safeguarding concerns, conduct complaints, data
// incidents, chat reports and service failures, each with an owner, deadlines
// and automatic escalation. Reviewed SQL migration:
// lib/db/migrations/20261123_accountability_and_class_chat.sql (adds CHECKs and
// the trigger that makes case events append-only).
export const accountabilityCasesTable = pgTable("accountability_cases", {
 id: serial("id").primaryKey(),
 organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
 kind: varchar("kind", { length: 24 }).notNull(),
 severity: varchar("severity", { length: 12 }).notNull(),
 status: varchar("status", { length: 16 }).notNull().default("open"),
 summary: text("summary").notNull(),
 reporterId: varchar("reporter_id").references(() => usersTable.id, { onDelete: "set null" }),
 subjectUserId: varchar("subject_user_id").references(() => usersTable.id, { onDelete: "set null" }),
 assignedTo: varchar("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
 escalationLevel: integer("escalation_level").notNull().default(0),
 jurisdiction: varchar("jurisdiction", { length: 5 }).notNull(),
 awareAt: timestamp("aware_at", { withTimezone: true }).notNull().defaultNow(),
 acknowledgeDueAt: timestamp("acknowledge_due_at", { withTimezone: true }).notNull(),
 resolveDueAt: timestamp("resolve_due_at", { withTimezone: true }).notNull(),
 regulatorDueAt: timestamp("regulator_due_at", { withTimezone: true }),
 regulatorNotifiedAt: timestamp("regulator_notified_at", { withTimezone: true }),
 acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
 resolvedAt: timestamp("resolved_at", { withTimezone: true }),
 closedAt: timestamp("closed_at", { withTimezone: true }),
 sourceMessageId: integer("source_message_id"),
 createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
 updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
 index("accountability_cases_org_status_idx").on(t.organizationId, t.status),
 index("accountability_cases_assignee_idx").on(t.assignedTo),
 index("accountability_cases_reporter_idx").on(t.reporterId),
]);

// Append-only: the migration's trigger refuses UPDATE. actorId has no foreign
// key so removing an account never rewrites history; NULL means the system
// (automatic escalation).
export const accountabilityCaseEventsTable = pgTable("accountability_case_events", {
 id: serial("id").primaryKey(),
 caseId: integer("case_id").notNull().references(() => accountabilityCasesTable.id, { onDelete: "cascade" }),
 organizationId: integer("organization_id").notNull(),
 actorId: varchar("actor_id"),
 action: varchar("action", { length: 24 }).notNull(),
 note: text("note").notNull().default(""),
 fromLevel: integer("from_level"),
 toLevel: integer("to_level"),
 createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("accountability_case_events_case_idx").on(t.caseId, t.id)]);
