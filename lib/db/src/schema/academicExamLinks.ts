import { integer, pgTable, serial, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { academicAssessmentsTable } from "./academic";
import { examAssignmentsTable } from "./organizations";
import { writtenExamAttemptsTable } from "./writtenExams";
export const academicExamLinksTable=pgTable("academic_exam_links",{
 id:serial("id").primaryKey(),
 assessmentId:integer("assessment_id").notNull().references(()=>academicAssessmentsTable.id,{onDelete:"cascade"}),
 assignmentId:integer("assignment_id").notNull().references(()=>examAssignmentsTable.id,{onDelete:"cascade"}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex("academic_exam_link_assessment_unique").on(t.assessmentId),uniqueIndex("academic_exam_link_assignment_unique").on(t.assignmentId)]);
export const academicExamReviewsTable=pgTable("academic_exam_reviews",{
 id:serial("id").primaryKey(),
 linkId:integer("link_id").notNull().references(()=>academicExamLinksTable.id,{onDelete:"cascade"}),
 attemptId:integer("attempt_id").notNull().references(()=>writtenExamAttemptsTable.id,{onDelete:"cascade"}),
 reviewerId:varchar("reviewer_id").notNull(),
 reviewedAt:timestamp("reviewed_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex("academic_exam_review_attempt_unique").on(t.attemptId)]);
