import { index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

/** Account-owned preferences; learning context does not establish legal age. */
export const lifelongPreferencesTable = pgTable("lifelong_preferences", {
 userId: varchar("user_id").primaryKey().references(() => usersTable.id, {onDelete:"cascade"}),
 learningContext: varchar("learning_context",{length:32}).notNull().default("lifelong"),
 preferredLanguage: varchar("preferred_language",{length:24}).notNull().default(""),
 learningGoal: text("learning_goal").notNull().default(""),
 updatedAt: timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
});

/** Stored URLs are private self-reports, never automatically verified or fetched. */
export const passportExternalLinksTable = pgTable("passport_external_links",{
 id:serial("id").primaryKey(),
 userId:varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 provider:varchar("provider",{length:80}).notNull(),
 url:text("url").notNull(),
 description:text("description").notNull().default(""),
 evidenceType:varchar("evidence_type",{length:32}).notNull().default("portfolio"),
 verificationStatus:varchar("verification_status",{length:24}).notNull().default("self_reported"),
 visibility:varchar("visibility",{length:16}).notNull().default("private"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("passport_link_user_url_unique").on(t.userId,t.url),index("passport_links_owner_idx").on(t.userId)]);

/** Never combine self-assessed levels into an intelligence or hiring score. */
export const passportCompetenciesTable = pgTable("passport_competencies",{
 id:serial("id").primaryKey(),
 userId:varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 skill:varchar("skill",{length:120}).notNull(),
 category:varchar("category",{length:32}).notNull(),
 masteryLevel:integer("mastery_level").notNull(),
 demonstration:varchar("demonstration",{length:32}).notNull(),
 description:text("description").notNull(),
 evidenceLinkId:integer("evidence_link_id").references(()=>passportExternalLinksTable.id,{onDelete:"set null"}),
 verificationStatus:varchar("verification_status",{length:24}).notNull().default("self_reported"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("passport_competency_owner_idx").on(t.userId,t.createdAt)]);
