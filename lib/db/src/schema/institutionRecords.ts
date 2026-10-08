import { index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { organizationsTable } from "./organizations";
/** Educator-asserted school record. Identity and institutional authority require independent verification before certification. */
export const verifiedEnrollmentsTable=pgTable("verified_enrollments",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 learnerId:varchar("learner_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 stage:varchar("stage",{length:28}).notNull(),
 academicYear:integer("academic_year").notNull(),
 status:varchar("status",{length:18}).notNull().default("active"),
 recordedBy:varchar("recorded_by").notNull().references(()=>usersTable.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("verified_enrollment_unique").on(t.organizationId,t.learnerId,t.stage,t.academicYear),index("verified_enrollments_learner_idx").on(t.learnerId)]);
/** Learner initiates; receiving institution accepts. No academic records transmitted by transfer. */
export const schoolTransfersTable=pgTable("school_transfers",{
 id:serial("id").primaryKey(),
 learnerId:varchar("learner_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 fromOrganizationId:integer("from_organization_id").notNull().references(()=>organizationsTable.id),
 toOrganizationId:integer("to_organization_id").notNull().references(()=>organizationsTable.id),
 fromEnrollmentId:integer("from_enrollment_id").notNull().references(()=>verifiedEnrollmentsTable.id),
 status:varchar("status",{length:20}).notNull().default("pending"),
 requestedBy:varchar("requested_by").notNull().references(()=>usersTable.id),
 processedBy:varchar("processed_by").references(()=>usersTable.id),
 reason:text("reason").notNull().default(""),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 decidedAt:timestamp("decided_at",{withTimezone:true})
},t=>[index("transfer_learner_idx").on(t.learnerId),index("transfer_target_idx").on(t.toOrganizationId)]);
/** A relationship request is not proof of lawful guardianship, and does not grant child-record access. */
export const guardianRelationshipsTable=pgTable("guardian_relationships",{
 id:serial("id").primaryKey(),
 learnerId:varchar("learner_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 guardianId:varchar("guardian_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 status:varchar("status",{length:20}).notNull().default("pending"),
 requestedAt:timestamp("requested_at",{withTimezone:true}).notNull().defaultNow(),
 respondedAt:timestamp("responded_at",{withTimezone:true})
},t=>[uniqueIndex("guardian_relationship_unique").on(t.learnerId,t.guardianId),index("guardian_requested_idx").on(t.guardianId)]);
