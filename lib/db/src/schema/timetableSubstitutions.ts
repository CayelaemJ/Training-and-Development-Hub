import {index,integer,pgTable,serial,text,timestamp,varchar} from "drizzle-orm/pg-core";
import {schoolTimetableSlotsTable} from "./schoolTimetable";
import {usersTable} from "./auth";
export const timetableSubstitutionEventsTable=pgTable("timetable_substitution_events",{
 id:serial("id").primaryKey(),
 slotId:integer("slot_id").notNull().references(()=>schoolTimetableSlotsTable.id,{onDelete:"cascade"}),
 originalTeacherId:varchar("original_teacher_id").notNull().references(()=>usersTable.id),
 replacementTeacherId:varchar("replacement_teacher_id").notNull().references(()=>usersTable.id),
 changedBy:varchar("changed_by").notNull().references(()=>usersTable.id),
 reason:text("reason").notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("timetable_substitution_slot_idx").on(t.slotId,t.createdAt)]);
