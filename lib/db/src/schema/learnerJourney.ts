import { index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { organizationsTable } from "./organizations";
/** Private, account-owned learner record. No national ID or date of birth is stored. */
export const learnerIdentitiesTable=pgTable("learner_identities",{
 userId:varchar("user_id").primaryKey().references(()=>usersTable.id,{onDelete:"cascade"}),
 displayName:varchar("display_name",{length:160}).notNull().default(""),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
});
/** Learning stage is an educational description, not a legal age assertion. */
export const learnerJourneysTable=pgTable("learner_journeys",{
 id:serial("id").primaryKey(),
 userId:varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 institutionId:integer("institution_id").references(()=>organizationsTable.id,{onDelete:"set null"}),
 institutionName:varchar("institution_name",{length:160}).notNull(),
 stage:varchar("stage",{length:40}).notNull(),
 academicYear:integer("academic_year").notNull(),
 note:text("note").notNull().default(""),
 source:varchar("source",{length:30}).notNull().default("self_report"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("journey_user_year_idx").on(t.userId,t.academicYear)]);
export const learnerMilestonesTable=pgTable("learner_milestones",{
 id:serial("id").primaryKey(),
 userId:varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 title:varchar("title",{length:160}).notNull(),
 description:text("description").notNull(),
 kind:varchar("kind",{length:40}).notNull(),
 year:integer("year").notNull(),
 source:varchar("source",{length:30}).notNull().default("self_report"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("milestone_user_year_idx").on(t.userId,t.year)]);
