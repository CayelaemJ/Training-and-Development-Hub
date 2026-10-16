import {integer,jsonb,pgTable,serial,timestamp,uniqueIndex,varchar,text} from "drizzle-orm/pg-core";
import {organizationsTable} from "./organizations";
import {usersTable} from "./auth";
export const issuedSchoolReportsTable=pgTable("issued_school_reports",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id),
 learnerId:varchar("learner_id").notNull().references(()=>usersTable.id),
 academicYear:integer("academic_year").notNull(),
 version:integer("version").notNull().default(1),
 status:varchar("status",{length:20}).notNull().default("submitted"),
 snapshot:jsonb("snapshot").notNull(),
 contentHash:varchar("content_hash",{length:64}).notNull(),
 submittedBy:varchar("submitted_by").notNull().references(()=>usersTable.id),
 reviewedBy:varchar("reviewed_by").references(()=>usersTable.id),
 issuedAt:timestamp("issued_at",{withTimezone:true}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("school_report_version_unique").on(t.organizationId,t.learnerId,t.academicYear,t.version)]);
export const schoolReportEventsTable=pgTable("school_report_events",{
 id:serial("id").primaryKey(),reportId:integer("report_id").notNull().references(()=>issuedSchoolReportsTable.id,{onDelete:"cascade"}),
 actorId:varchar("actor_id").notNull().references(()=>usersTable.id),action:varchar("action",{length:24}).notNull(),reason:text("reason").notNull().default(""),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
});
