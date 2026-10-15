import { index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./auth";
/** Pilot registry for ten CABO education-to-career modules. Every record is institution-bound. */
export const hubRecordsTable=pgTable("hub_records",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 kind:varchar("kind",{length:40}).notNull(),
 title:varchar("title",{length:180}).notNull(),
 description:text("description").notNull().default(""),
 startAt:timestamp("start_at",{withTimezone:true}),
 endAt:timestamp("end_at",{withTimezone:true}),
 subjectId:varchar("subject_id").references(()=>usersTable.id),
 createdBy:varchar("created_by").notNull().references(()=>usersTable.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("hub_records_org_kind_idx").on(t.organizationId,t.kind),index("hub_records_subject_idx").on(t.subjectId)]);
