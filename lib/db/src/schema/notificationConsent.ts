import { boolean, index, integer, pgTable, primaryKey, serial, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { organizationsTable } from "./organizations";
import { notificationOutboxTable } from "./notificationOutbox";

/** Explicit school/kind email choices; no row = denied. Children need separate guardian review. */
export const notificationPreferencesTable=pgTable("notification_preferences",{
  userId:varchar("user_id",{length:128}).notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
  organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
  kind:varchar("kind",{length:40}).notNull(),
  optedIn:boolean("opted_in").notNull().default(false),
  confirmedAt:timestamp("confirmed_at",{withTimezone:true}),
  revokedAt:timestamp("revoked_at",{withTimezone:true}),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
  primaryKey({columns:[t.userId,t.organizationId,t.kind]}),
  index("notification_preferences_org_idx").on(t.organizationId,t.kind),
]);
/** Foreign-key-bound source prevents a queue row from claiming unrelated children or schools. */
export const notificationEventSourcesTable=pgTable("notification_event_sources",{
  eventId:uuid("event_id").primaryKey().references(()=>notificationOutboxTable.eventId,{onDelete:"cascade"}),
  sourceKind:varchar("source_kind",{length:32}).notNull(),
  sourceId:integer("source_id").notNull(),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[index("notification_source_lookup_idx").on(t.sourceKind,t.sourceId)]);

/** Append-only proof of explicit, account-owned choice; no email or child identifiers. */
export const notificationPreferenceEventsTable=pgTable("notification_preference_events",{
  id:serial("id").primaryKey(),
  userId:varchar("user_id",{length:128}).notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
  organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
  kind:varchar("kind",{length:40}).notNull(),
  action:varchar("action",{length:12}).notNull(),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[index("notification_preference_events_user_idx").on(t.userId,t.organizationId,t.createdAt)]);
