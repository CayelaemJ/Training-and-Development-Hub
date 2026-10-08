import {index,integer,pgTable,serial,text,timestamp,uniqueIndex,varchar} from "drizzle-orm/pg-core";
import {organizationsTable} from "./organizations";
import {usersTable} from "./auth";
export const careerApplicationsTable=pgTable("career_applications",{
 id:serial("id").primaryKey(),
 opportunityId:integer("opportunity_id").notNull(),
 candidateId:varchar("candidate_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 statement:text("statement").notNull().default(""),
 status:varchar("status",{length:24}).notNull().default("submitted"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("career_application_unique").on(t.opportunityId,t.candidateId),index("career_application_candidate_idx").on(t.candidateId)]);
export const assessmentPassportsTable=pgTable("assessment_passports",{
 id:serial("id").primaryKey(),
 candidateId:varchar("candidate_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 instrumentName:varchar("instrument_name",{length:160}).notNull(),
 provider:varchar("provider",{length:160}).notNull(),
 version:varchar("version",{length:64}).notNull(),
 assessedAt:timestamp("assessed_at",{withTimezone:true}).notNull(),
 reviewDueAt:timestamp("review_due_at",{withTimezone:true}).notNull(),
 evidenceType:varchar("evidence_type",{length:28}).notNull().default("development"),
 summary:text("summary").notNull().default(""),
 verificationStatus:varchar("verification_status",{length:24}).notNull().default("unverified"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("assessment_passport_candidate_idx").on(t.candidateId)]);
