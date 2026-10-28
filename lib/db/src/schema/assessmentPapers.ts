import {index,integer,jsonb,pgTable,serial,timestamp,varchar,text} from "drizzle-orm/pg-core";
import {organizationsTable} from "./organizations";
import {usersTable} from "./auth";
export const assessmentPapersTable=pgTable("assessment_papers",{
 id:serial("id").primaryKey(),organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 academicYear:integer("academic_year").notNull(),grade:varchar("grade",{length:24}).notNull(),subject:varchar("subject",{length:120}).notNull(),
 curriculum:varchar("curriculum",{length:32}).notNull(),title:varchar("title",{length:180}).notNull(),status:varchar("status",{length:24}).notNull().default("draft"),
 questions:jsonb("questions").notNull(),createdBy:varchar("created_by").notNull().references(()=>usersTable.id),
 approvedBy:varchar("approved_by").references(()=>usersTable.id),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("assessment_paper_org_year_idx").on(t.organizationId,t.academicYear)]);
export const assessmentPaperEventsTable=pgTable("assessment_paper_events",{
 id:serial("id").primaryKey(),paperId:integer("paper_id").notNull().references(()=>assessmentPapersTable.id,{onDelete:"cascade"}),
 actorId:varchar("actor_id").notNull().references(()=>usersTable.id),action:varchar("action",{length:24}).notNull(),
 note:text("note").notNull().default(""),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
});
