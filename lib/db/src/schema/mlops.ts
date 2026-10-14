import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar, real } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

// One registry per institution/organisation. Never store raw answers, medical
// records, identifiable learner data or credentials in MLOps telemetry.
export const mlModelVersionsTable = pgTable("ml_model_versions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  modelKey: varchar("model_key", { length: 100 }).notNull(),
  version: varchar("version", { length: 100 }).notNull(),
  provider: varchar("provider", { length: 80 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("shadow"),
  evaluation: jsonb("evaluation"),
  approvedBy: varchar("approved_by", { length: 120 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("ml_model_version_unique").on(t.organizationId, t.modelKey, t.version),
  index("ml_model_versions_lookup").on(t.organizationId, t.modelKey, t.status),
]);

export const mlEvaluationRunsTable = pgTable("ml_evaluation_runs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  modelVersionId: integer("model_version_id").notNull().references(() => mlModelVersionsTable.id),
  domain: varchar("domain", { length: 40 }).notNull(),
  sampleCount: integer("sample_count").notNull(),
  meanAbsoluteError: real("mean_absolute_error"),
  agreementRate: real("agreement_rate"),
  humanReviewRate: real("human_review_rate"),
  passed: boolean("passed").notNull(),
  summary: jsonb("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("ml_eval_tenant_date").on(t.organizationId, t.createdAt)]);

export const mlOperationalEventsTable = pgTable("ml_operational_events", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  modelKey: varchar("model_key", { length: 100 }).notNull(),
  version: varchar("version", { length: 100 }).notNull(),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  durationMs: integer("duration_ms"),
  tokenCount: integer("token_count"),
  estimatedCostUsd: real("estimated_cost_usd"),
  status: varchar("status", { length: 25 }).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("ml_ops_tenant_date").on(t.organizationId, t.createdAt)]);
