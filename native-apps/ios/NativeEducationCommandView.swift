import SwiftUI

struct NativeEducationCommandView: View {
    @ObservedObject var session: NativeSession
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            List {
                Section {
                    Text("Only schools your account is authorised to oversee are included. Small learner cohorts are suppressed.")
                    Text("No learner names or individual records are returned by this view.")
                        .font(.footnote).foregroundColor(.secondary)
                } header: {
                    Text("Privacy-safe overview")
                }

                Section {
                    Text("Internal planning view · not an official national census")
                        .font(.headline).foregroundColor(Color(red: 0.48, green: 0.25, blue: 0.15))
                    Text("Attendance reflects recorded entries. It does not establish enrolment quality or school performance.")
                    if !session.educationCommandNotice.isEmpty {
                        Text(session.educationCommandNotice)
                            .foregroundColor(.secondary)
                        Button("Retry") { Task { await session.refreshEducationCommand() } }
                            .disabled(session.educationCommandBusy)
                    }
                    if session.educationCommandBusy { ProgressView("Loading authorised school totals…") }
                } header: {
                    Text("How to read these figures")
                }

                if let overview = session.educationCommand {
                    Section("Academic year \(overview.year)") {
                        LabeledContent("Authorised schools", value: String(overview.institutions))
                        LabeledContent("Minimum cohort shown", value: String(overview.minimumCohort))
                    }
                    Section("School summaries") {
                        if overview.schools.isEmpty {
                            Text("No school aggregates are available for this account and year.")
                                .foregroundColor(.secondary)
                        }
                        ForEach(overview.schools) { school in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(school.name).font(.headline)
                                Text(school.learnerCount.map { "At least \($0) active verified learners" }
                                     ?? "Learner count suppressed for privacy (fewer than \(overview.minimumCohort))")
                                    .font(.subheadline)
                                Text(school.attendanceRate.map { "Recorded attendance: \($0)% · \(overview.year)" }
                                     ?? "No attendance rate available for this year")
                                    .font(.subheadline).foregroundColor(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    Section {
                        Text(!overview.nationalVerified || !overview.officialDbEData
                             ? "CABO has not verified this as national or official education data."
                             : "National and official-data status is supplied by the server.")
                            .font(.footnote).foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Education Command")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        session.clearEducationCommand()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Refresh") { Task { await session.refreshEducationCommand() } }
                        .disabled(session.educationCommandBusy)
                }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .task {
            if session.educationCommand == nil && session.educationCommandNotice.isEmpty {
                await session.refreshEducationCommand()
            }
        }
        .onDisappear { session.clearEducationCommand() }
    }
}
