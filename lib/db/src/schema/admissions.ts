import {index,integer,pgTable,serial,text,timestamp,uniqueIndex,varchar} from "drizzle-orm/pg-core";
import {usersTable} from "./auth";
export const admissionInstitutionsTable=pgTable("admission_institutions",{
 id:serial("id").primaryKey(),name:varchar("name",{length:180}).notNull(),officialUrl:text("official_url").notNull(),province:varchar("province",{length:60}).notNull(),route:varchar("route",{length:20}).notNull().default("handoff"),verification:varchar("verification",{length:24}).notNull().default("directory_only"),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("admission_institution_name_unique").on(t.name)]);
export const admissionProgrammesTable=pgTable("admission_programmes",{
 id:serial("id").primaryKey(),institutionId:integer("institution_id").notNull().references(()=>admissionInstitutionsTable.id,{onDelete:"cascade"}),name:varchar("name",{length:200}).notNull(),faculty:varchar("faculty",{length:120}).notNull().default(""),qualification:varchar("qualification",{length:100}).notNull().default(""),requirements:text("requirements").notNull().default(""),status:varchar("status",{length:20}).notNull().default("draft"),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("admission_programmes_institution_idx").on(t.institutionId)]);
export const admissionApplicationsTable=pgTable("admission_applications",{
 id:serial("id").primaryKey(),candidateId:varchar("candidate_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),programmeId:integer("programme_id").notNull().references(()=>admissionProgrammesTable.id),status:varchar("status",{length:24}).notNull().default("draft"),candidateStatement:text("candidate_statement").notNull().default(""),disclosureApprovedAt:timestamp("disclosure_approved_at",{withTimezone:true}),externalReference:varchar("external_reference",{length:150}),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("admission_candidate_programme_unique").on(t.candidateId,t.programmeId),index("admission_candidate_idx").on(t.candidateId)]);
export const admissionEventsTable=pgTable("admission_events",{
 id:serial("id").primaryKey(),applicationId:integer("application_id").notNull().references(()=>admissionApplicationsTable.id,{onDelete:"cascade"}),actorId:varchar("actor_id").notNull().references(()=>usersTable.id),fromStatus:varchar("from_status",{length:24}).notNull(),toStatus:varchar("to_status",{length:24}).notNull(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
});
