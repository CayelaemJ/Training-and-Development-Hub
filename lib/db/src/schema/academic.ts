import { index, integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./auth";
export type AcademicFramework="NSC"|"IEB"|"UNIVERSITY"|"CUSTOM";
export const academicSettingsTable=pgTable("academic_settings",{
 organizationId:integer("organization_id").primaryKey().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 institutionType:varchar("institution_type",{length:20}).notNull(),
 framework:varchar("framework",{length:20}).notNull(),
 academicYear:integer("academic_year").notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
});
export const academicCoursesTable=pgTable("academic_courses",{
 id:serial("id").primaryKey(),organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 name:varchar("name",{length:200}).notNull(),code:varchar("code",{length:50}).notNull(),
 level:varchar("level",{length:50}).notNull(),credits:integer("credits"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex("academic_course_org_code_level_unique").on(t.organizationId,t.code,t.level)]);
export const academicPeriodsTable=pgTable("academic_periods",{
 id:serial("id").primaryKey(),organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 name:varchar("name",{length:100}).notNull(),year:integer("year").notNull(),
 beginsAt:timestamp("begins_at",{withTimezone:true}),endsAt:timestamp("ends_at",{withTimezone:true})
},t=>[index("academic_period_org_idx").on(t.organizationId)]);
export const courseEnrollmentsTable=pgTable("academic_enrollments",{
 id:serial("id").primaryKey(),
 courseId:integer("course_id").notNull().references(()=>academicCoursesTable.id,{onDelete:"cascade"}),
 userId:varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("academic_enrollment_unique").on(t.courseId,t.userId)]);
export const academicAssessmentsTable=pgTable("academic_assessments",{
 id:serial("id").primaryKey(),organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 courseId:integer("course_id").notNull().references(()=>academicCoursesTable.id,{onDelete:"cascade"}),
 periodId:integer("period_id").notNull().references(()=>academicPeriodsTable.id,{onDelete:"cascade"}),
 title:varchar("title",{length:200}).notNull(),
 category:varchar("category",{length:32}).notNull(),
 maxMarks:real("max_marks").notNull(),
 weight:real("weight").notNull(),
 instructions:text("instructions"),
 dueAt:timestamp("due_at",{withTimezone:true}),
 createdBy:varchar("created_by").notNull().references(()=>usersTable.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[index("academic_assessment_course_period_idx").on(t.courseId,t.periodId)]);
export const academicGradesTable=pgTable("academic_grades",{
 id:serial("id").primaryKey(),assessmentId:integer("assessment_id").notNull().references(()=>academicAssessmentsTable.id,{onDelete:"cascade"}),
 learnerId:varchar("learner_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 marks:real("marks").notNull(),
 status:varchar("status",{length:20}).notNull().default("draft"),
 reviewedBy:varchar("reviewed_by").references(()=>usersTable.id),
 feedback:text("feedback"),
 updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("academic_grades_unique").on(t.assessmentId,t.learnerId)]);
export const academicGradeEventsTable=pgTable("academic_grade_events",{
 id:serial("id").primaryKey(),gradeId:integer("grade_id").notNull().references(()=>academicGradesTable.id,{onDelete:"cascade"}),
 changedBy:varchar("changed_by").notNull().references(()=>usersTable.id),
 oldMarks:real("old_marks"),newMarks:real("new_marks").notNull(),oldStatus:varchar("old_status",{length:20}),
 newStatus:varchar("new_status",{length:20}).notNull(),reason:text("reason").notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
});
