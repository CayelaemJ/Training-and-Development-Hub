import { index, integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
export const platformAdminAuditTable=pgTable("platform_admin_audit",{
 id:serial("id").primaryKey(),
 actorId:varchar("actor_id").notNull().references(()=>usersTable.id),
 action:varchar("action",{length:80}).notNull(),
 organizationId:integer("organization_id"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("platform_admin_audit_actor_idx").on(t.actorId,t.createdAt)]);
