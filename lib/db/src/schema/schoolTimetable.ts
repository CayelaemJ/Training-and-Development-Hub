import {index,integer,pgTable,serial,timestamp,uniqueIndex,varchar} from "drizzle-orm/pg-core";
import {organizationsTable} from "./organizations";
import {usersTable} from "./auth";
export const schoolTimetableSlotsTable=pgTable("school_timetable_slots",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 academicYear:integer("academic_year").notNull(),
 day:integer("day").notNull(),
 startsAt:varchar("starts_at",{length:5}).notNull(),
 endsAt:varchar("ends_at",{length:5}).notNull(),
 grade:varchar("grade",{length:16}).notNull(),
 group:varchar("group_name",{length:40}).notNull(),
 subject:varchar("subject",{length:100}).notNull(),
 room:varchar("room",{length:80}).notNull(),
 teacherId:varchar("teacher_id").notNull().references(()=>usersTable.id),
 status:varchar("status",{length:24}).notNull().default("draft"),
 createdBy:varchar("created_by").notNull().references(()=>usersTable.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("timetable_slots_org_year_idx").on(t.organizationId,t.academicYear),index("timetable_slots_teacher_idx").on(t.teacherId,t.day)]);
