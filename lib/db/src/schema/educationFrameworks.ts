import {
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./auth";
export const educationFrameworkVersionsTable = pgTable(
  "education_framework_versions",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    frameworkCode: varchar("framework_code", { length: 80 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    timeZone: varchar("time_zone", { length: 80 }).notNull(),
    languages: jsonb("languages").$type<string[]>().notNull(),
    settings: jsonb("settings")
      .$type<{
        levels: string[];
        gradingScale: { label: string; minimumPercent: number }[];
        curriculumVersion: string;
        notes: string;
      }>()
      .notNull(),
    createdBy: varchar("created_by")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("education_framework_current").on(t.organizationId, t.id)],
);
