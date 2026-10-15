import {integer,pgTable,text,timestamp,varchar} from "drizzle-orm/pg-core";
import {organizationsTable} from "./organizations";
import {usersTable} from "./auth";
/** Self-reported profile; official EMIS/registration verification is a separate process. */
export const institutionSetupTable=pgTable("institution_setup",{
 organizationId:integer("organization_id").primaryKey().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 institutionType:varchar("institution_type",{length:30}).notNull(),
 province:varchar("province",{length:60}).notNull(),
 district:varchar("district",{length:120}).notNull(),
 circuit:varchar("circuit",{length:120}).notNull().default(""),
 officialReference:varchar("official_reference",{length:100}).notNull().default(""),
 curriculum:varchar("curriculum",{length:40}).notNull(),
 language:varchar("language",{length:40}).notNull().default("English"),
 academicYear:integer("academic_year").notNull(),
 status:varchar("status",{length:24}).notNull().default("draft"),
 updatedBy:varchar("updated_by").notNull().references(()=>usersTable.id),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
});
