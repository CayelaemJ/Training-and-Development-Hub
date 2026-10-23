import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export interface StoredQuestion {
  prompt: string;
  options: string[];
  correctOption: number;
  explanation: string;
}

export interface StoredFeedback {
  questionIndex: number;
  selectedOption: number;
  correctOption: number;
  explanation: string;
  isCorrect: boolean;
}

export const uploadIntentsTable = pgTable(
  "upload_intents",
  {
    objectPath: text("object_path").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 512 }).notNull(),
    contentType: varchar("content_type", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("upload_intents_user_id_idx").on(table.userId)],
);

export const studyMaterialsTable = pgTable(
  "study_materials",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    fileName: varchar("file_name", { length: 512 }).notNull(),
    contentType: varchar("content_type", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    objectPath: text("object_path").notNull().unique(),
    characterCount: integer("character_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("study_materials_user_id_idx").on(table.userId)],
);

export const quizzesTable = pgTable(
  "training_quizzes",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    materialId: integer("material_id")
      .notNull()
      .references(() => studyMaterialsTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    difficulty: varchar("difficulty", { length: 24 }).notNull(),
    questionCount: integer("question_count").notNull(),
    optionCount: integer("option_count").notNull(),
    modelId: varchar("model_id", { length: 100 }).notNull(),
    promptVersion: varchar("prompt_version", { length: 32 }).notNull(),
    questions: jsonb("questions").$type<StoredQuestion[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("training_quizzes_user_id_idx").on(table.userId),
    index("training_quizzes_material_id_idx").on(table.materialId),
  ],
);

export const quizAttemptsTable = pgTable(
  "quiz_attempts",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    quizId: integer("quiz_id")
      .notNull()
      .references(() => quizzesTable.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<number[]>().notNull(),
    correctCount: integer("correct_count").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    percentage: real("percentage").notNull(),
    feedback: jsonb("feedback").$type<StoredFeedback[]>().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("quiz_attempts_user_id_idx").on(table.userId),
    index("quiz_attempts_quiz_id_idx").on(table.quizId),
  ],
);

export const studyMaterialInsertSchema = createInsertSchema(studyMaterialsTable)
  .omit({ id: true, createdAt: true })
  .extend({
    title: z.string().min(1).max(200),
  });

export const quizInsertSchema = createInsertSchema(quizzesTable).omit({
  id: true,
  createdAt: true,
});

export const quizAttemptInsertSchema = createInsertSchema(
  quizAttemptsTable,
).omit({ id: true, completedAt: true });

export type StudyMaterial = typeof studyMaterialsTable.$inferSelect;
export type Quiz = typeof quizzesTable.$inferSelect;
export type QuizAttempt = typeof quizAttemptsTable.$inferSelect;