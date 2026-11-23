import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { organizationsTable } from "./organizations";

/**
 * Learner-approved, revocable, time-limited shares of a learner's passport with
 * one university, college or employer. Default is no access: a recipient sees
 * only what an active, unexpired share grants, and every view is logged.
 */
export const passportSharesTable = pgTable("passport_shares", {
  id: serial("id").primaryKey(),
  learnerId: varchar("learner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  purpose: varchar("purpose", { length: 20 }).notNull(),
  scope: jsonb("scope").$type<string[]>().notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  guardianId: varchar("guardian_id").references(() => usersTable.id, { onDelete: "set null" }),
  guardianDecidedAt: timestamp("guardian_decided_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("passport_shares_learner_idx").on(t.learnerId, t.createdAt),
  index("passport_shares_recipient_idx").on(t.organizationId, t.status),
  check("passport_shares_status_check", sql`${t.status} IN ('pending_guardian','active','declined','revoked')`),
  check("passport_shares_purpose_check", sql`${t.purpose} IN ('admission','bursary','employment','internship')`),
]);

export const passportShareViewsTable = pgTable("passport_share_views", {
  id: serial("id").primaryKey(),
  shareId: integer("share_id").notNull().references(() => passportSharesTable.id, { onDelete: "cascade" }),
  viewerId: varchar("viewer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("passport_share_views_share_idx").on(t.shareId, t.viewedAt)]);
