import { index, integer, pgTable, serial, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// AI credits: a monthly allowance from the person's plan, plus purchased or
// granted top-ups. Reviewed SQL migration: lib/db/migrations/20261123_ai_credits.sql.
export const aiSubscriptionsTable = pgTable("ai_subscriptions", {
 userId: varchar("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
 plan: varchar("plan", { length: 16 }).notNull(),
 status: varchar("status", { length: 16 }).notNull(),
 currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
 provider: varchar("provider", { length: 16 }).notNull(),
 providerReference: varchar("provider_reference", { length: 120 }),
 updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiCreditLedgerTable = pgTable("ai_credit_ledger", {
 id: serial("id").primaryKey(),
 userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
 kind: varchar("kind", { length: 16 }).notNull(),
 delta: integer("delta").notNull(),
 operation: varchar("operation", { length: 32 }),
 reference: varchar("reference", { length: 120 }),
 createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
 index("ai_credit_ledger_user_idx").on(t.userId, t.createdAt),
 uniqueIndex("ai_credit_ledger_reference_idx").on(t.reference),
]);
