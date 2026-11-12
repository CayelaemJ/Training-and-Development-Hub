import { sql } from "drizzle-orm";
import { boolean, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

/** Learner-entered personalization only. Never populated from inferred traits or chat analysis. */
export const learnerAiProfilesTable = pgTable("learner_ai_profiles", {
  userId: varchar("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  personalizationEnabled: boolean("personalization_enabled").notNull().default(false),
  goals: jsonb("goals").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  interests: jsonb("interests").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  preferredLanguage: varchar("preferred_language", { length: 24 }).notNull().default(""),
  explanationStyle: varchar("explanation_style", { length: 24 }).notNull().default("step_by_step"),
  learningPreferences: jsonb("learning_preferences").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
