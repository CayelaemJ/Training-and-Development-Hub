import {index,integer,pgTable,serial,text,timestamp,uniqueIndex,varchar} from "drizzle-orm/pg-core";
import {organizationsTable} from "./organizations";
import {usersTable} from "./auth";
/** Structured observation and improvement tasks scoped to one active school enrolment. */
export const schoolStageProgressTable=pgTable("school_stage_progress",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 learnerId:varchar("learner_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 stage:varchar("stage",{length:20}).notNull(),
 grade:varchar("grade",{length:4}).notNull(),
 academicYear:integer("academic_year").notNull(),
 domain:varchar("domain",{length:40}).notNull(),
 title:varchar("title",{length:180}).notNull(),
 observation:text("observation").notNull().default(""),
 nextStep:text("next_step").notNull().default(""),
 progress:varchar("progress",{length:24}).notNull().default("observing"),
 recordedBy:varchar("recorded_by").notNull().references(()=>usersTable.id),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("school_stage_progress_learner_idx").on(t.learnerId,t.academicYear),index("school_stage_progress_institution_idx").on(t.organizationId,t.stage)]);
