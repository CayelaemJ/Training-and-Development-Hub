import {index,integer,pgTable,serial,timestamp,varchar} from "drizzle-orm/pg-core";
import {guardianRelationshipsTable} from "./institutionRecords";
import {organizationsTable} from "./organizations";
import {usersTable} from "./auth";
/** No identity-document bytes or sensitive verification evidence are stored here. */
export const guardianVerificationEventsTable=pgTable("guardian_verification_events",{
 id:serial("id").primaryKey(),
 relationshipId:integer("relationship_id").notNull().references(()=>guardianRelationshipsTable.id,{onDelete:"cascade"}),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 reviewedBy:varchar("reviewed_by").notNull().references(()=>usersTable.id),
 decision:varchar("decision",{length:20}).notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("guardian_verification_relation_idx").on(t.relationshipId,t.createdAt)]);
