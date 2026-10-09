import { index, integer, pgTable, serial, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./auth";

/** Institutional management units form a tree inside ONE organisation; never cross tenants. */
export const managementUnitsTable=pgTable("management_units",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 parentId:integer("parent_id"),
 name:varchar("name",{length:160}).notNull(),
 type:varchar("type",{length:32}).notNull(),
 createdBy:varchar("created_by").notNull().references(()=>usersTable.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("management_units_org_idx").on(t.organizationId),index("management_units_parent_idx").on(t.parentId)]);
/** All grants require an administrator with delegated authority; role is not inferred from the UI. */
export const managementRoleGrantsTable=pgTable("management_role_grants",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 unitId:integer("unit_id").notNull().references(()=>managementUnitsTable.id,{onDelete:"cascade"}),
 userId:varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 role:varchar("role",{length:40}).notNull(),
 grantedBy:varchar("granted_by").notNull().references(()=>usersTable.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("management_grant_unique").on(t.unitId,t.userId,t.role),index("management_grant_user_idx").on(t.userId,t.organizationId)]);
