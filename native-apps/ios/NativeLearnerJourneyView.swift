import SwiftUI

struct NativeLearnerJourneyView: View {
    @ObservedObject var session: NativeSession
    @Environment(\.dismiss) private var dismiss
    @State private var displayName = ""
    @State private var institution = ""
    @State private var stage = "RR"
    @State private var entryYear = Calendar.current.component(.year, from: Date())
    @State private var note = ""
    @State private var milestoneTitle = ""
    @State private var milestoneDescription = ""
    @State private var milestoneKind = "project"
    @State private var milestoneYear = Calendar.current.component(.year, from: Date())
    @State private var busy = false
    @State private var message: String?
    @State private var isError = false

    private let stages = ["RR", "R"] + (1...12).map(String.init) + ["university", "college", "training", "professional"]
    private let kinds = ["academic", "project", "community", "creative", "technical", "personal_growth", "other"]

    var body: some View {
        NavigationView {
            Form {
                Section {
                    Text("A private, self-reported record of learning and growth. These entries are not official school records and are never shared automatically.")
                        .font(.subheadline).foregroundColor(.secondary)
                    TextField("Preferred display name", text: $displayName)
                        .textContentType(.nickname).accessibilityLabel("Preferred display name")
                    Button("Save identity") { perform { try await session.updateJourney(displayName: displayName) } }
                        .disabled(busy || displayName.count > 160)
                } header: { Text("My identity") }

                Section {
                    if session.journeyEntries.isEmpty {
                        Text("Add your first learning stage.").foregroundColor(.secondary)
                    }
                    ForEach(session.journeyEntries) { entry in
                        VStack(alignment: .leading, spacing: 5) {
                            Text("\(entry.academicYear) · \(stageLabel(entry.stage))").font(.headline)
                            Text(entry.institutionName)
                            if !entry.note.isEmpty { Text(entry.note).font(.subheadline).foregroundColor(.secondary) }
                            HStack {
                                Text("Self-reported").font(.caption).foregroundColor(.secondary)
                                Spacer()
                                Button("Remove", role: .destructive) {
                                    perform { try await session.deleteJourneyItem("api/learner-journey/entries/\(entry.id)") }
                                }.disabled(busy)
                            }
                        }.padding(.vertical, 3)
                    }
                } header: { Text("Education timeline") }

                Section("Add a learning stage") {
                    TextField("School, college or institution", text: $institution)
                        .textInputAutocapitalization(.words).accessibilityLabel("School or institution")
                    Picker("Stage", selection: $stage) {
                        ForEach(stages, id: \.self) { Text(stageLabel($0)).tag($0) }
                    }
                    Stepper("Year: \(entryYear)", value: $entryYear, in: 1900...2200)
                    TextEditor(text: $note).frame(minHeight: 90).accessibilityLabel("Timeline note")
                    Button("Add learning stage") {
                        perform { try await session.updateJourney(displayName: displayName, institution: institution,
                            stage: stage, year: entryYear, note: note) }
                    }
                    .disabled(busy || institution.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
                }

                Section("Development milestones") {
                    if session.journeyMilestones.isEmpty {
                        Text("Achievements and moments of growth you choose to record will appear here.")
                            .foregroundColor(.secondary)
                    }
                    ForEach(session.journeyMilestones) { milestone in
                        VStack(alignment: .leading, spacing: 5) {
                            Text("\(milestone.year) · \(milestone.title)").font(.headline)
                            Text(milestone.kind.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(.caption).foregroundColor(.secondary)
                            Text(milestone.description)
                            HStack {
                                Text("Self-reported").font(.caption).foregroundColor(.secondary)
                                Spacer()
                                Button("Remove", role: .destructive) {
                                    perform { try await session.deleteJourneyItem("api/learner-journey/milestones/\(milestone.id)") }
                                }.disabled(busy)
                            }
                        }.padding(.vertical, 3)
                    }
                }

                Section("Add a milestone") {
                    TextField("Milestone title", text: $milestoneTitle)
                        .textInputAutocapitalization(.sentences).accessibilityLabel("Milestone title")
                    Picker("Type", selection: $milestoneKind) {
                        ForEach(kinds, id: \.self) { Text($0.replacingOccurrences(of: "_", with: " ").capitalized).tag($0) }
                    }
                    Stepper("Year: \(milestoneYear)", value: $milestoneYear, in: 1900...2200)
                    TextEditor(text: $milestoneDescription).frame(minHeight: 120)
                        .accessibilityLabel("Milestone description")
                    Button("Add milestone") {
                        perform { try await session.updateJourney(displayName: displayName,
                            year: milestoneYear, milestoneTitle: milestoneTitle,
                            description: milestoneDescription, kind: milestoneKind) }
                    }
                    .disabled(busy || milestoneTitle.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 ||
                              milestoneDescription.trimmingCharacters(in: .whitespacesAndNewlines).count < 10)
                }
                if let message {
                    Section { Text(message).foregroundColor(isError ? .red : .secondary).accessibilityAddTraits(.isStaticText) }
                }
            }
            .navigationTitle("My learning journey")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .navigationBarTrailing) { Button("Done") { dismiss() } } }
            .overlay { if busy { ProgressView("Saving securely…").padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14)) } }
            .onAppear { displayName = session.journeyIdentity.displayName }
            .onChange(of: session.journeyIdentity.displayName) { displayName = $0 }
        }
        .navigationViewStyle(StackNavigationViewStyle())
    }

    private func perform(_ action: @escaping () async throws -> Void) {
        guard !busy else { return }
        busy = true; message = nil
        Task {
            do { try await action(); message = "Saved to your private CABO journey."; isError = false }
            catch { message = "Could not save this change. Check your connection and try again."; isError = true }
            busy = false
        }
    }

    private func stageLabel(_ value: String) -> String {
        ["RR", "R"].contains(value) || Int(value) != nil ? "Grade \(value)" : value.capitalized
    }
}
