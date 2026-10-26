import { index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./auth";
import { organizationsTable } from "./organizations";
import { passportCompetenciesTable } from "./lifelongPassport";

/** Layer 2: AI suggestions. Never a credential, grade, staff attestation or proof. */
export const passportAiInterpretationsTable=pgTable("passport_ai_interpretations",{
 id:serial("id").primaryKey(),
 userId:varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 competencyId:integer("competency_id").notNull().references(()=>passportCompetenciesTable.id,{onDelete:"cascade"}),
 summary:text("summary").notNull(),
 practiceSuggestion:text("practice_suggestion").notNull(),
 limitations:text("limitations").notNull(),
 modelId:varchar("model_id",{length:160}).notNull(),
 promptVersion:varchar("prompt_version",{length:40}).notNull(),
 sourceDigest:varchar("source_digest",{length:64}).notNull(),
 reviewState:varchar("review_state",{length:20}).notNull().default("unreviewed"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("passport_ai_user_idx").on(t.userId,t.createdAt)]);

/** Layer 3: opt-in and explicitly authorized institution review. */
export const passportAchievementReviewsTable=pgTable("passport_achievement_reviews",{
 id:serial("id").primaryKey(),
 userId:varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 competencyId:integer("competency_id").notNull().references(()=>passportCompetenciesTable.id,{onDelete:"cascade"}),
 status:varchar("status",{length:20}).notNull().default("pending"),
 reviewerId:varchar("reviewer_id").references(()=>usersTable.id,{onDelete:"set null"}),
 reviewNote:text("review_note"),
 reviewedAt:timestamp("reviewed_at",{withTimezone:true}),
 revokedBy:varchar("revoked_by").references(()=>usersTable.id,{onDelete:"set null"}),
 revokedAt:timestamp("revoked_at",{withTimezone:true}),
 revokeReason:text("revoke_reason"),
 requestedAt:timestamp("requested_at",{withTimezone:true}).notNull().defaultNow()
},t=>[
 index("passport_review_owner_idx").on(t.userId,t.requestedAt),
 index("passport_review_org_queue_idx").on(t.organizationId,t.status),
 uniqueIndex("passport_review_active_unique").on(t.organizationId,t.competencyId).where(sql.raw("status IN ('pending','verified')"))
]);

export const passportAchievementAuditTable=pgTable("passport_achievement_audit",{
 id:serial("id").primaryKey(),
 reviewId:integer("review_id").notNull().references(()=>passportAchievementReviewsTable.id,{onDelete:"cascade"}),
 actorId:varchar("actor_id").notNull().references(()=>usersTable.id),
 action:varchar("action",{length:20}).notNull(),
 explanation:text("explanation").notNull().default(""),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("passport_review_audit_idx").on(t.reviewId,t.id)]);
