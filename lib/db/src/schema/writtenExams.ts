import { index, integer, jsonb, pgTable, real, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { studyMaterialsTable } from "./training";

export interface WrittenQuestion {
  prompt: string;
  type: "short_answer" | "long_answer" | "scenario";
  maxMarks: number;
  rubric: string;
  referenceAnswer: string;
  sourceExcerpt: string;
}
export interface WrittenMark {
  questionIndex: number;
  awardedMarks: number;
  maxMarks: number;
  feedback: string;
  evidence: string;
  needsReview: boolean;
}
export const writtenExamsTable = pgTable("written_exams", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  materialId: integer("material_id").notNull().references(() => studyMaterialsTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  difficulty: varchar("difficulty", { length: 24 }).notNull(),
  questions: jsonb("questions").$type<WrittenQuestion[]>().notNull(),
  modelId: varchar("model_id", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("written_exams_user_idx").on(t.userId)]);
export const writtenExamAttemptsTable = pgTable("written_exam_attempts", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => writtenExamsTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<string[]>().notNull(),
  feedback: jsonb("feedback").$type<WrittenMark[]>().notNull(),
  awardedMarks: real("awarded_marks").notNull(),
  maxMarks: integer("max_marks").notNull(),
  percentage: real("percentage").notNull(),
  reviewRequired: integer("review_required").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("written_exam_attempts_user_idx").on(t.userId)]);
