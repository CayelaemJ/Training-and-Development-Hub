import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { organizationsTable } from "./organizations";
export const potentialProfilesTable=pgTable("potential_profiles",{
 userId:varchar("user_id").primaryKey().references(()=>usersTable.id,{onDelete:"cascade"}),
 headline:varchar("headline",{length:180}).notNull().default(""),
 about:text("about").notNull().default(""),
 aspirations:text("aspirations").notNull().default(""),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
});
export const potentialEvidenceTable=pgTable("potential_evidence",{
 id:serial("id").primaryKey(), userId:varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 category:varchar("category",{length:30}).notNull(), title:varchar("title",{length:160}).notNull(),
 description:text("description").notNull(), source:varchar("source",{length:40}).notNull().default("self_report"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("potential_evidence_user_idx").on(t.userId)]);
export const careerOpportunitiesTable=pgTable("career_opportunities",{
 id:serial("id").primaryKey(), organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 createdBy:varchar("created_by").notNull().references(()=>usersTable.id), title:varchar("title",{length:180}).notNull(),
 kind:varchar("kind",{length:32}).notNull(),description:text("description").notNull(),
 status:varchar("status",{length:16}).notNull().default("active"),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("career_opportunities_org_idx").on(t.organizationId)]);
export const employerAccessRequestsTable=pgTable("employer_access_requests",{
 id:serial("id").primaryKey(),organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 requesterId:varchar("requester_id").notNull().references(()=>usersTable.id),
 personId:varchar("person_id").notNull().references(()=>usersTable.id),
 purpose:text("purpose").notNull(), scope:varchar("scope",{length:32}).notNull(),
 status:varchar("status",{length:16}).notNull().default("pending"),
 expiresAt:timestamp("expires_at",{withTimezone:true}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 decidedAt:timestamp("decided_at",{withTimezone:true})
},t=>[index("employer_access_person_idx").on(t.personId),index("employer_access_org_idx").on(t.organizationId)]);
export const employerAccessAuditTable=pgTable("employer_access_audit",{
 id:serial("id").primaryKey(),requestId:integer("request_id").notNull().references(()=>employerAccessRequestsTable.id,{onDelete:"cascade"}),
 actorId:varchar("actor_id").notNull().references(()=>usersTable.id),action:varchar("action",{length:30}).notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
});
