import SwiftUI

struct NativeSchoolIntelligenceView: View {
    @ObservedObject var session: NativeSession
    let organizationId: Int
    let organizationName: String

    @Environment(\.dismiss) private var dismiss
    @State private var yearText = String(Calendar.current.component(.year, from: Date()))
    @State private var snapshot: NativeSchoolIntelligenceSnapshot?
    @State private var busy = false
    @State private var notice = ""

    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("Attendance & academic signals")
                            .font(.title2.bold())
                            .accessibilityAddTraits(.isHeader)
                        Text(organizationName).font(.headline)
                        Text("Educator review only")
                            .font(.subheadline.bold()).foregroundColor(Color(red: 0.48, green: 0.25, blue: 0.15))
                        Text("Low marks and absences are prompts for human support. They are not automated punishments, psychological labels or progression decisions.")
                            .font(.subheadline)
                        Text("Attendance reflects recorded entries and is not verified district data.")
                            .font(.footnote).foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))

                    TextField("Academic year", text: $yearText)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityLabel("Academic year")
                    Button(snapshot == nil ? "Load school signals" : "Refresh school signals") {
                        Task { await refresh() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(busy || !validYear)
                    .frame(maxWidth: .infinity, alignment: .leading)

                    if busy { ProgressView("Loading authorised school records…") }
                    if !notice.isEmpty {
                        Text(notice).font(.footnote).foregroundColor(.red)
                        Button("Retry") { Task { await refresh() } }.disabled(busy || !validYear)
                    }

                    if let snapshot {
                        Text("Academic year \(snapshot.year)").font(.headline)
                        HStack(spacing: 8) {
                            metric("Attendance records", String(snapshot.attendanceRecords))
                            metric("Learners reviewed", String(snapshot.studentsReviewed))
                        }
                        HStack(spacing: 8) {
                            metric("Need educator attention", String(snapshot.attentionNeeded))
                            metric("Official district data", snapshot.officialDistrictData ? "Yes" : "No")
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Recorded attendance").font(.headline)
                            Text("\(snapshot.attendanceRecords) entries · year \(snapshot.year)")
                            ForEach(snapshot.attendanceCounts.keys.sorted(), id: \.self) { key in
                                Text("\(key.capitalized): \(snapshot.attendanceCounts[key] ?? 0)")
                                    .font(.footnote).foregroundColor(.secondary)
                            }
                            if snapshot.attendanceCounts.isEmpty { Text("No attendance records available for this year.") }
                        }
                        .font(.subheadline)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(16)
                        .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))

                        Text("Academic attention register").font(.title3.bold()).accessibilityAddTraits(.isHeader)
                        Text("Server thresholds: subject average below \(snapshot.subjectBelow)% or recorded attendance below \(snapshot.attendanceBelow)%. Review each case with the learner.")
                            .font(.footnote).foregroundColor(.secondary)
                        if snapshot.learners.isEmpty {
                            Text("No learner assessments available for this year.")
                                .font(.subheadline).foregroundColor(.secondary)
                        }
                        ForEach(snapshot.learners) { learner in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(learner.learnerId).font(.headline)
                                Text("Grade \(learner.grade) · \(learner.supportPlans) existing support entries")
                                    .font(.subheadline)
                                Text("Average \(percent(learner.average)) · Attendance \(percent(learner.attendanceRate))")
                                    .font(.subheadline)
                                if !learner.subjectsAtRisk.isEmpty {
                                    Text("Educator review: \(learner.subjectsAtRisk.joined(separator: ", "))")
                                        .font(.footnote)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(14)
                            .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                .padding(16)
                .frame(maxWidth: 720, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("School intelligence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .task { await refresh() }
    }

    private var validYear: Bool {
        guard let year = Int(yearText) else { return false }
        return (2000...2200).contains(year)
    }

    private func refresh() async {
        guard let year = Int(yearText), (2000...2200).contains(year), !busy else {
            if !validYear { notice = "Enter an academic year from 2000 to 2200." }
            return
        }
        busy = true
        notice = ""
        defer { busy = false }
        do {
            snapshot = try await session.fetchSchoolIntelligence(organizationId: organizationId, year: year)
        } catch {
            snapshot = nil
            notice = "School signals are unavailable for this account right now. Check your connection and try again."
        }
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.caption).foregroundColor(.secondary)
            Text(value).font(.title3.bold()).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(12)
        .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private func percent(_ value: Double?) -> String {
        value.map { String(format: "%.1f%%", $0) } ?? "—"
    }
}
