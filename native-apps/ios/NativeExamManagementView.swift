import SwiftUI

struct NativeExamManagementView: View {
    @ObservedObject var session: NativeSession
    @State private var organizationId = 0
    @State private var groupId = 0
    @State private var examId = 0
    @State private var dueAt = ""
    @State private var message: String?

    private var workspace: NativeExamManagementWorkspace? {
        session.examManagementWorkspaces.first(where: { $0.organizationId == organizationId })
            ?? session.examManagementWorkspaces.first
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Create an assignment") {
                    if session.examManagementBusy {
                        ProgressView("Loading school assignments and submissions…")
                    } else if session.examManagementWorkspaces.isEmpty {
                        Text("No school manager workspace is available for this account.")
                            .foregroundColor(.secondary)
                    } else {
                        Picker("School", selection: $organizationId) {
                            ForEach(session.examManagementWorkspaces) { item in
                                Text(item.organizationName).tag(item.organizationId)
                            }
                        }
                        .onChange(of: organizationId) { _ in groupId = 0 }
                        if let workspace {
                            if let notice = workspace.notice { Text(notice).foregroundColor(.secondary) }
                            if workspace.groups.isEmpty {
                                Text("Create a learner group in the CABO school workspace before assigning an exam.")
                                    .foregroundColor(.secondary)
                            } else {
                                Picker("Learner group", selection: $groupId) {
                                    Text("Choose a group").tag(0)
                                    ForEach(workspace.groups) { group in Text(group.name).tag(group.id) }
                                }
                            }
                            if session.writtenExams.isEmpty {
                                Text("Create a written exam from your study material first.")
                                    .foregroundColor(.secondary)
                            } else {
                                Picker("Written exam", selection: $examId) {
                                    Text("Choose an exam").tag(0)
                                    ForEach(session.writtenExams) { exam in
                                        Text("\(exam.title) · \(exam.questions.count) questions").tag(exam.id)
                                    }
                                }
                            }
                            TextField("Optional deadline · 2026-12-01T16:00Z", text: $dueAt)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                            Button("Assign exam to group") {
                                Task {
                                    do {
                                        try await session.createExamAssignment(
                                            organizationId: workspace.organizationId, groupId: groupId,
                                            examId: examId, dueAt: dueAt.trimmingCharacters(in: .whitespacesAndNewlines)
                                        )
                                        message = "Exam assigned to the selected group."
                                        dueAt = ""
                                    } catch {
                                        message = "CABO could not create this assignment. Check the group, exam and deadline, then retry."
                                    }
                                }
                            }
                            .disabled(session.busy || session.examManagementBusy || groupId <= 0 || examId <= 0)
                        }
                    }
                    NavigationLink(destination: NativeWrittenExamView(session: session)) {
                        Label("Create a written exam", systemImage: "doc.badge.plus")
                    }
                }

                if let workspace {
                    Section("Assignments · \(workspace.organizationName)") {
                        if workspace.assignments.isEmpty {
                            Text("No written exams assigned yet.").foregroundColor(.secondary)
                        }
                        ForEach(workspace.assignments) { assignment in
                            let group = workspace.groups.first(where: { $0.id == assignment.groupId })?.name ?? "Group \(assignment.groupId)"
                            let exam = session.writtenExams.first(where: { $0.id == assignment.examId })?.title ?? "Exam \(assignment.examId)"
                            VStack(alignment: .leading, spacing: 4) {
                                Text(exam).font(.headline)
                                Text(group).font(.subheadline).foregroundColor(.secondary)
                                if let deadline = assignment.dueAt {
                                    Text("Due \(String(deadline.prefix(16)).replacingOccurrences(of: "T", with: " ")) UTC")
                                        .font(.footnote).foregroundColor(.secondary)
                                }
                            }
                        }
                    }

                    Section("Learner submissions · \(workspace.organizationName)") {
                        if workspace.submissions.isEmpty {
                            Text("Submitted papers will appear here.").foregroundColor(.secondary)
                        }
                        ForEach(workspace.submissions) { submission in
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Submission #\(submission.id) · \(submission.percentage.formatted())%")
                                    .font(.headline)
                                Text("\(submission.awardedMarks.formatted()) / \(submission.maxMarks.formatted()) marks · Assignment #\(submission.assignmentId)")
                                    .font(.subheadline).foregroundColor(.secondary)
                                ForEach(submission.feedback, id: \.questionIndex) { mark in
                                    let assignedExamId = workspace.assignments.first(where: { $0.id == submission.assignmentId })?.examId
                                    let prompt = assignedExamId.flatMap { examId in
                                        session.writtenExams.first(where: { $0.id == examId })
                                    }.flatMap { exam in exam.questions.indices.contains(mark.questionIndex)
                                        ? exam.questions[mark.questionIndex].prompt : nil }
                                    NativeExamOverrideRow(
                                        session: session, organizationId: workspace.organizationId,
                                        submission: submission, mark: mark, prompt: prompt
                                    )
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
                if let message { Section { Text(message).foregroundColor(.secondary) } }
            }
            .navigationTitle("Exam assignments")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Refresh") { Task { await session.refresh() } }.disabled(session.busy)
                }
            }
            .onAppear {
                if organizationId == 0 { organizationId = session.examManagementWorkspaces.first?.organizationId ?? 0 }
                if groupId == 0 { groupId = workspace?.groups.first?.id ?? 0 }
            }
        }
    }
}

private struct NativeExamOverrideRow: View {
    @ObservedObject var session: NativeSession
    let organizationId: Int
    let submission: NativeManagedExamSubmission
    let mark: NativeWrittenExamMark
    let prompt: String?
    @State private var marksText = ""
    @State private var reason = ""
    @State private var message: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Question \(mark.questionIndex + 1) · AI marked \(mark.awardedMarks.formatted()) / \(mark.maxMarks.formatted())")
                .font(.subheadline.weight(.semibold))
            if mark.needsReview { Label("Needs educator review", systemImage: "exclamationmark.circle").font(.footnote).foregroundColor(.orange) }
            if mark.questionIndex < submission.answers.count {
                Text("Learner response: \(submission.answers[mark.questionIndex])").font(.footnote)
            }
            Text(mark.feedback).font(.footnote).foregroundColor(.secondary)
            TextField("Adjusted marks", text: $marksText)
                .keyboardType(.decimalPad)
                .accessibilityIdentifier("manager-exam-marks-\(submission.id)-\(mark.questionIndex)")
            TextField("Reason for adjustment (required)", text: $reason)
                .lineLimit(2)
            Button("Save educator mark review") {
                Task {
                    guard let value = Double(marksText), value <= mark.maxMarks else {
                        message = "Enter a valid mark between zero and the question maximum."
                        return
                    }
                    do {
                        try await session.overrideExamSubmission(organizationId: organizationId,
                            submissionId: submission.id, questionIndex: mark.questionIndex,
                            awardedMarks: value, reason: reason)
                        message = "Educator mark review saved."
                    } catch {
                        message = "CABO could not save this review. Check the mark and reason, then retry."
                    }
                }
            }
            .disabled(Double(marksText).map { $0 <= mark.maxMarks } != true ||
                reason.trimmingCharacters(in: .whitespacesAndNewlines).count < 5 || session.busy)
            if let message { Text(message).font(.footnote).foregroundColor(.secondary) }
        }
        .padding(12)
        .background(Color(UIColor.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
        .onAppear { if marksText.isEmpty { marksText = String(mark.awardedMarks) } }
    }
}
