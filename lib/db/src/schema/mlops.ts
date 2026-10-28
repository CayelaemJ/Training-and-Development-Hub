import { boolean, check, foreignKey, index, integer, pgTable, serial, timestamp, uniqueIndex, varchar, real } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { sql } from "drizzle-orm";
import { usersTable } from "./auth";

// One registry per institution/organisation. Never store raw answers, medical
// records, identifiable learner data or credentials in MLOps telemetry.
export const mlModelVersionsTable = pgTable("ml_model_versions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  modelKey: varchar("model_key", { length: 100 }).notNull(),
  version: varchar("version", { length: 100 }).notNull(),
  provider: varchar("provider", { length: 80 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("shadow"),
  approvedBy: varchar("approved_by", { length: 120 }).references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("ml_model_version_unique").on(t.organizationId, t.modelKey, t.version),
  uniqueIndex("ml_model_versions_id_org_unique").on(t.id, t.organizationId),
  index("ml_model_versions_lookup").on(t.organizationId, t.modelKey, t.status),
  check("ml_model_versions_status_check", sql`${t.status} in ('shadow', 'approved', 'paused', 'retired')`),
  check("ml_model_versions_provider_check", sql`${t.provider} in ('groq', 'openai', 'huggingface')`),
  check("ml_model_versions_key_check", sql`${t.modelKey} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'`),
  check("ml_model_versions_version_check", sql`${t.version} ~ '^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,99}$'`),
]);

export const mlEvaluationRunsTable = pgTable("ml_evaluation_runs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  modelVersionId: integer("model_version_id").notNull(),
  domain: varchar("domain", { length: 40 }).notNull(),
  sampleCount: integer("sample_count").notNull(),
  meanAbsoluteError: real("mean_absolute_error"),
  normalizedMeanAbsoluteError: real("normalized_mean_absolute_error"),
  agreementRate: real("agreement_rate"),
  humanReviewRate: real("human_review_rate"),
  passed: boolean("passed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("ml_eval_tenant_date").on(t.organizationId, t.createdAt),
  foreignKey({ columns: [t.modelVersionId, t.organizationId], foreignColumns: [mlModelVersionsTable.id, mlModelVersionsTable.organizationId], name: "ml_eval_model_version_org_fk" }).onDelete("cascade"),
  check("ml_eval_sample_count_check", sql`${t.sampleCount} between 0 and 500`),
  check("ml_eval_domain_check", sql`${t.domain} = 'academic_grading'`),
  check("ml_eval_metrics_range_check", sql`(${t.meanAbsoluteError} is null or ${t.meanAbsoluteError} between 0 and 1000) and (${t.normalizedMeanAbsoluteError} is null or ${t.normalizedMeanAbsoluteError} between 0 and 1) and (${t.agreementRate} is null or ${t.agreementRate} between 0 and 1) and (${t.humanReviewRate} is null or ${t.humanReviewRate} between 0 and 1)`),
]);

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("ml_ops_tenant_date").on(t.organizationId, t.createdAt),
  check("ml_ops_event_type_check", sql`${t.eventType} in ('grading', 'evaluation')`),
  check("ml_ops_status_check", sql`${t.status} in ('success', 'failure', 'timeout')`),
  check("ml_ops_duration_check", sql`${t.durationMs} is null or ${t.durationMs} between 0 and 900000`),
  check("ml_ops_token_count_check", sql`${t.tokenCount} is null or ${t.tokenCount} between 0 and 1000000`),
  check("ml_ops_cost_check", sql`${t.estimatedCostUsd} is null or ${t.estimatedCostUsd} between 0 and 1000`),
]);
