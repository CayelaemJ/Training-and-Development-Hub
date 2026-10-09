import {index,integer,pgTable,serial,text,timestamp,uniqueIndex,varchar} from "drizzle-orm/pg-core";
import {organizationsTable} from "./organizations";
import {usersTable} from "./auth";
export const schoolAttendanceTable=pgTable("school_attendance",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 learnerId:varchar("learner_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 day:varchar("day",{length:10}).notNull(),
 status:varchar("status",{length:16}).notNull(),
 note:text("note").notNull().default(""),
 recordedBy:varchar("recorded_by").notNull().references(()=>usersTable.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("school_attendance_unique").on(t.organizationId,t.learnerId,t.day),index("school_attendance_learner_idx").on(t.learnerId,t.day)]);
export const schoolNoticesTable=pgTable("school_notices",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 subject:varchar("subject",{length:180}).notNull(),
 message:text("message").notNull(),
 audience:varchar("audience",{length:16}).notNull().default("learners"),
 createdBy:varchar("created_by").notNull().references(()=>usersTable.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("school_notices_org_idx").on(t.organizationId,t.createdAt)]);
