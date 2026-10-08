import { index, integer, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, varchar, real } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { writtenExamsTable, writtenExamAttemptsTable } from "./writtenExams";

export const organizationsTable = pgTable("organizations", {
 id: serial("id").primaryKey(),
 name: varchar("name",{length:200}).notNull(),
 ownerId: varchar("owner_id").notNull().references(()=>usersTable.id),
 createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
});
export const organizationMembersTable = pgTable("organization_members",{
 organizationId: integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 userId: varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 role: varchar("role",{length:24}).notNull(),
 joinedAt: timestamp("joined_at",{withTimezone:true}).notNull().defaultNow()
},t=>[primaryKey({columns:[t.organizationId,t.userId]}),index("org_members_user_idx").on(t.userId)]);
export const learnerGroupsTable = pgTable("learner_groups",{
 id: serial("id").primaryKey(),
 organizationId: integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 name: varchar("name",{length:200}).notNull(),
 createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("learner_groups_org_idx").on(t.organizationId)]);
export const learnerGroupMembersTable = pgTable("learner_group_members",{
 groupId: integer("group_id").notNull().references(()=>learnerGroupsTable.id,{onDelete:"cascade"}),
 userId: varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"})
},t=>[primaryKey({columns:[t.groupId,t.userId]})]);
export const examAssignmentsTable = pgTable("exam_assignments",{
 id:serial("id").primaryKey(),
 organizationId:integer("organization_id").notNull().references(()=>organizationsTable.id,{onDelete:"cascade"}),
 groupId:integer("group_id").notNull().references(()=>learnerGroupsTable.id,{onDelete:"cascade"}),
 examId:integer("exam_id").notNull().references(()=>writtenExamsTable.id,{onDelete:"cascade"}),
 createdBy:varchar("created_by").notNull().references(()=>usersTable.id),
 dueAt:timestamp("due_at",{withTimezone:true}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("exam_assignments_org_idx").on(t.organizationId),uniqueIndex("exam_assignments_group_exam_idx").on(t.groupId,t.examId)]);
export const assignmentSubmissionsTable = pgTable("assignment_submissions",{
 id:serial("id").primaryKey(),
 assignmentId:integer("assignment_id").notNull().references(()=>examAssignmentsTable.id,{onDelete:"cascade"}),
 userId:varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 attemptId:integer("attempt_id").notNull().references(()=>writtenExamAttemptsTable.id,{onDelete:"cascade"}),
 submittedAt:timestamp("submitted_at",{withTimezone:true}).notNull().defaultNow()
},t=>[uniqueIndex("assignment_submissions_attempt_unique").on(t.attemptId),index("assignment_submissions_assignment_idx").on(t.assignmentId)]);
export const assessorOverridesTable=pgTable("assessor_overrides",{
 id:serial("id").primaryKey(),
 submissionId:integer("submission_id").notNull().references(()=>assignmentSubmissionsTable.id,{onDelete:"cascade"}),
 assessorId:varchar("assessor_id").notNull().references(()=>usersTable.id),
 questionIndex:integer("question_index").notNull(),
 awardedMarks:real("awarded_marks").notNull(),
 reason:text("reason").notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("assessor_overrides_submission_idx").on(t.submissionId)]);
