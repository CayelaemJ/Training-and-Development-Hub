import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./auth";

/**
 * Out-of-band, authorised school data release register. School administrators
 * cannot approve their own organisation simply by submitting a web form.
 * An entry is necessary but NOT sufficient proof of legal compliance.
 */
export const institutionDataClearancesTable = pgTable("institution_data_clearances",{
  organizationId: integer("organization_id").primaryKey()
    .references(()=>organizationsTable.id,{onDelete:"cascade"}),
  countryCode: varchar("country_code",{length:2}).notNull(),
  state: varchar("state",{length:16}).notNull().default("blocked"),
  evidenceReference: text("evidence_reference").notNull(),
  authorisedBy: varchar("authorised_by").notNull().references(()=>usersTable.id),
  approvedAt: timestamp("approved_at",{withTimezone:true}).notNull(),
  expiresAt: timestamp("expires_at",{withTimezone:true}).notNull(),
  updatedAt: timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
});
