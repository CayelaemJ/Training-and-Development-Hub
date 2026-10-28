import {index,integer,pgTable,serial,timestamp,varchar} from "drizzle-orm/pg-core";
import {organizationsTable} from "./organizations";
import {verifiedEnrollmentsTable} from "./institutionRecords";
import {usersTable} from "./auth";
export const schoolProgressionEventsTable=pgTable("school_progression_events",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 priorEnrollmentId:integer("prior_enrollment_id").notNull().references(()=>verifiedEnrollmentsTable.id),
 newEnrollmentId:integer("new_enrollment_id").notNull().references(()=>verifiedEnrollmentsTable.id),
 learnerId:varchar("learner_id").notNull().references(()=>usersTable.id),
 fromGrade:varchar("from_grade",{length:28}).notNull(),
 toGrade:varchar("to_grade",{length:28}).notNull(),
 decision:varchar("decision",{length:16}).notNull(),
 approvedBy:varchar("approved_by").notNull().references(()=>usersTable.id),
 approvedAt:timestamp("approved_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("school_progression_org_idx").on(t.organizationId,t.approvedAt),index("school_progression_learner_idx").on(t.learnerId)]);
