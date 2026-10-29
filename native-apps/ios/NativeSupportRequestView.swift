import SwiftUI

struct NativeSupportRequestView: View {
    @ObservedObject var session: NativeSession
    @Environment(\.dismiss) private var dismiss
    @State private var selectedCourseID = ""
    @State private var concept = ""
    @State private var question = ""
    @State private var attempted = ""
    @State private var message: String?
    @State private var sendingID: String?
    @State private var editingDraftID: String?

    private var selectedCourse: NativeSupportCourse? {
        session.supportCourses.first(where: { $0.id == selectedCourseID })
    }

    var body: some View {
        NavigationView {
            Form {
                Section {
                    Text("Tell your educator where you are stuck. Your request is sent to the school linked to this course.")
                        .font(.subheadline).foregroundColor(.secondary)
                    if session.supportCourses.isEmpty {
                        Text("No eligible courses are available. Refresh when online or contact your educator.")
                            .foregroundColor(.secondary)
                    } else {
                        Picker("Course", selection: $selectedCourseID) {
                            Text("Choose a course").tag("")
                            ForEach(session.supportCourses) { course in
                                Text(course.name).tag(course.id)
                            }
                        }
                        TextField("Topic or concept", text: $concept)
                            .textInputAutocapitalization(.sentences)
                        VStack(alignment: .leading, spacing: 6) {
                            Text("What would you like help with?").font(.subheadline).foregroundColor(.secondary)
                            TextEditor(text: $question).frame(minHeight: 100)
                                .accessibilityLabel("What would you like help with?")
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("What have you tried so far?").font(.subheadline).foregroundColor(.secondary)
                            TextEditor(text: $attempted).frame(minHeight: 85)
                                .accessibilityLabel("What have you tried so far?")
                        }
                    }
                } header: {
                    Text("Ask for learning support")
                } footer: {
                    Text("Your draft stays encrypted in this device’s Keychain until you send it. CABO checks access with the school when submitted.")
                }

                Section("Saved drafts · \(session.supportDrafts.count)") {
                    if session.supportDrafts.isEmpty {
                        Text("Drafts you save will appear here.").foregroundColor(.secondary)
                    }
                    ForEach(session.supportDrafts) { draft in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(draft.concept).font(.headline)
                            Text("\(draft.courseName) · \(draft.question)")
                                .font(.subheadline).foregroundColor(.secondary).lineLimit(3)
                            HStack {
                                Button {
                                    Task { await send(draft) }
                                } label: {
                                    if sendingID == draft.id { ProgressView() }
                                    else { Label("Send", systemImage: "paperplane.fill") }
                                }
                                .disabled(sendingID != nil || session.busy)
                                Button("Edit") {
                                    if let course = session.supportCourses.first(where: {
                                        $0.organizationId == draft.organizationId && $0.courseId == draft.courseId
                                    }) { selectedCourseID = course.id }
                                    concept = draft.concept
                                    question = draft.question
                                    attempted = draft.attempted
                                    editingDraftID = draft.requestKey
                                    message = "Edit the draft above, then save it to replace the saved version."
                                }
                                .disabled(sendingID != nil)
                                Spacer()
                                Button("Delete", role: .destructive) {
                                    do { try session.deleteSupportDraft(draft.requestKey) }
                                    catch { message = "Could not remove this saved draft." }
                                }
                                .disabled(sendingID != nil)
                            }
                            .buttonStyle(.borderless)
                        }
                        .padding(.vertical, 4)
                    }
                }

                if let message {
                    Section { Text(message).font(.subheadline) }
                }
            }
            .navigationTitle("Learning support")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save draft") { saveDraft() }
                        .disabled(selectedCourse == nil || sendingID != nil)
                }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .onAppear {
            if selectedCourseID.isEmpty { selectedCourseID = session.supportCourses.first?.id ?? "" }
        }
    }

    private func saveDraft() {
        guard let course = selectedCourse else { return }
        do {
            _ = try session.saveSupportDraft(course: course, concept: concept,
                                            question: question, attempted: attempted)
            if let editingDraftID {
                try session.deleteSupportDraft(editingDraftID)
            }
            concept = ""
            question = ""
            attempted = ""
            editingDraftID = nil
            message = "Draft saved securely on this device."
        } catch {
            message = error.localizedDescription
        }
    }

    private func send(_ draft: NativeSupportDraft) async {
        sendingID = draft.id
        message = nil
        defer { sendingID = nil }
        do {
            try await session.sendSupportDraft(draft)
            message = "Your request was sent to your educator."
        } catch {
            message = "Could not confirm sending. The saved draft is still here; retry when connected."
        }
    }
}
