import { index, integer, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./auth";
import { academicCoursesTable } from "./academic";

// Teacher-moderated class chat: one channel per academic course, opened by
// staff. There are no direct messages between learners. Reviewed SQL
// migration: lib/db/migrations/20261123_accountability_and_class_chat.sql.
export const classChatChannelsTable = pgTable("class_chat_channels", {
 id: serial("id").primaryKey(),
 organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
 courseId: integer("course_id").notNull().references(() => academicCoursesTable.id, { onDelete: "cascade" }),
 status: varchar("status", { length: 12 }).notNull().default("open"),
 createdBy: varchar("created_by").notNull().references(() => usersTable.id),
 createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("class_chat_channels_course_idx").on(t.courseId)]);

export const classChatMessagesTable = pgTable("class_chat_messages", {
 id: serial("id").primaryKey(),
 channelId: integer("channel_id").notNull().references(() => classChatChannelsTable.id, { onDelete: "cascade" }),
 organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
 authorId: varchar("author_id").references(() => usersTable.id, { onDelete: "set null" }),
 body: text("body").notNull(),
 status: varchar("status", { length: 12 }).notNull().default("visible"),
 screenReason: varchar("screen_reason", { length: 40 }),
 moderatedBy: varchar("moderated_by").references(() => usersTable.id, { onDelete: "set null" }),
 moderatedAt: timestamp("moderated_at", { withTimezone: true }),
 moderationReason: text("moderation_reason"),
 createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
 index("class_chat_messages_channel_idx").on(t.channelId, t.id),
 index("class_chat_messages_author_idx").on(t.authorId, t.createdAt),
]);

export const classChatReportsTable = pgTable("class_chat_reports", {
 id: serial("id").primaryKey(),
 messageId: integer("message_id").notNull().references(() => classChatMessagesTable.id, { onDelete: "cascade" }),
 reporterId: varchar("reporter_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
 reason: varchar("reason", { length: 24 }).notNull(),
 caseId: integer("case_id"),
 createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("class_chat_reports_once_idx").on(t.messageId, t.reporterId)]);

export const classChatMutesTable = pgTable("class_chat_mutes", {
 channelId: integer("channel_id").notNull().references(() => classChatChannelsTable.id, { onDelete: "cascade" }),
 userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
 mutedBy: varchar("muted_by").notNull().references(() => usersTable.id),
 reason: text("reason").notNull(),
 until: timestamp("until", { withTimezone: true }).notNull(),
 createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.channelId, t.userId] })]);
