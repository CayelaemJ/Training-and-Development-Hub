import {index,integer,pgTable,serial,text,timestamp,varchar} from "drizzle-orm/pg-core";
import {organizationsTable} from "./organizations";
import {usersTable} from "./auth";
export const assessmentQuestionBankTable=pgTable("assessment_question_bank",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 grade:varchar("grade",{length:24}).notNull(),
 subject:varchar("subject",{length:120}).notNull(),
 curriculum:varchar("curriculum",{length:32}).notNull(),
 stem:text("stem").notNull(),
 answerGuide:text("answer_guide").notNull(),
 rubric:text("rubric").notNull().default(""),
 sourceAttribution:text("source_attribution").notNull(),
 license:varchar("license",{length:60}).notNull(),
 status:varchar("status",{length:24}).notNull().default("draft"),
 createdBy:varchar("created_by").notNull().references(()=>usersTable.id),
 reviewedBy:varchar("reviewed_by").references(()=>usersTable.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("question_bank_org_grade_subject_idx").on(t.organizationId,t.grade,t.subject)]);
export const assessmentQuestionEventsTable=pgTable("assessment_question_events",{
 id:serial("id").primaryKey(),
 questionId:integer("question_id").notNull().references(()=>assessmentQuestionBankTable.id,{onDelete:"cascade"}),
 actorId:varchar("actor_id").notNull().references(()=>usersTable.id),
 action:varchar("action",{length:24}).notNull(),
 note:text("note").notNull().default(""),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
});
