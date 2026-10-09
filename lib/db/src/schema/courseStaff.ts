import {integer,pgTable,primaryKey,timestamp,varchar,index} from "drizzle-orm/pg-core";
import {organizationsTable} from "./organizations";
import {academicCoursesTable} from "./academic";
import {usersTable} from "./auth";
export const courseStaffAssignmentsTable=pgTable("course_staff_assignments",{
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 courseId:integer("course_id").notNull().references(()=>academicCoursesTable.id,{onDelete:"cascade"}),
 staffId:varchar("staff_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 assignedBy:varchar("assigned_by").notNull().references(()=>usersTable.id),
 assignedAt:timestamp("assigned_at",{withTimezone:true}).notNull().defaultNow()
},t=>[primaryKey({columns:[t.courseId,t.staffId]}),index("course_staff_scope_idx").on(t.organizationId,t.staffId)]);
