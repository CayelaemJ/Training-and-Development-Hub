import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./auth";
import { academicCoursesTable, academicGradesTable } from "./academic";
import { educationFrameworkVersionsTable } from "./educationFrameworks";
export const learnerSupportTicketsTable = pgTable(
  "learner_support_tickets",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id),
    frameworkVersionId: integer("framework_version_id").references(
      () => educationFrameworkVersionsTable.id,
    ),
    courseId: integer("course_id")
      .notNull()
      .references(() => academicCoursesTable.id),
    learnerId: varchar("learner_id")
      .notNull()
      .references(() => usersTable.id),
    concept: varchar("concept", { length: 160 }).notNull(),
    question: text("question").notNull(),
    attempted: text("attempted").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("open"),
    assignedTo: varchar("assigned_to").references(() => usersTable.id),
    version: integer("version").notNull().default(1),
    requestKey: varchar("request_key", { length: 80 }).notNull(),
    baselineGradeId: integer("baseline_grade_id").references(
      () => academicGradesTable.id,
    ),
    followupGradeId: integer("followup_grade_id").references(
      () => academicGradesTable.id,
    ),
    outcome: jsonb("outcome").$type<{
      baseline: number;
      followup: number;
      improvementPp: number;
      comparisonReason: string;
      reviewedBy: string;
    }>(),
    feedback: varchar("feedback", { length: 24 }),
    reviewAt: timestamp("review_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("support_request_idempotency").on(t.learnerId, t.requestKey),
    index("support_org_queue").on(t.organizationId, t.status, t.id),
    index("support_learner_timeline").on(t.learnerId, t.organizationId, t.id),
    index("support_assignee_queue").on(t.assignedTo, t.status, t.id),
  ],
);
export const learnerSupportEventsTable = pgTable(
  "learner_support_events",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => learnerSupportTicketsTable.id),
    actorId: varchar("actor_id")
      .notNull()
      .references(() => usersTable.id),
    kind: varchar("kind", { length: 32 }).notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("support_event_timeline").on(t.ticketId, t.id)],
);
