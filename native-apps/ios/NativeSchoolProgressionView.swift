import SwiftUI

struct NativeSchoolProgressionView: View {
    @ObservedObject var session: NativeSession
    let organizationId: Int
    let organizationName: String

    @Environment(\.dismiss) private var dismiss
    @State private var yearText = String(Calendar.current.component(.year, from: Date()))
    @State private var snapshot: NativeSchoolProgressionSnapshot?
    @State private var busy = false
    @State private var savingId: Int?
    @State private var notice = ""
    @State private var error = ""
    @State private var pendingCandidate: NativeSchoolProgressionCandidate?
    @State private var pendingDecision = ""

    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Year-end progression").font(.title2.bold()).accessibilityAddTraits(.isHeader)
                        Text(organizationName).font(.headline)
                        Text("Administrator decision required").font(.subheadline.bold())
                        Text("Promoting or repeating creates a next-year enrolment and completes the previous year. CABO does not decide progression.")
                            .font(.subheadline)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).padding(16)
                    .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))

                    TextField("Current academic year", text: $yearText)
                        .keyboardType(.numberPad).textFieldStyle(.roundedBorder)
                        .accessibilityLabel("Current academic year")
                    Button(snapshot == nil ? "Load active enrolments" : "Refresh enrolments") {
                        Task { await refresh() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(busy || savingId != nil || !validYear)

                    if busy { ProgressView("Loading authorised enrolments…") }
                    if savingId != nil { ProgressView("Saving progression decision…") }
                    if !notice.isEmpty { Text(notice).font(.footnote).foregroundColor(.green) }
                    if !error.isEmpty { Text(error).font(.footnote).foregroundColor(.red) }

                    if let snapshot {
                        Text("Active enrolments · \(snapshot.year)")
                            .font(.title3.bold()).accessibilityAddTraits(.isHeader)
                        if snapshot.candidates.isEmpty {
                            Text("No eligible active school enrolments found for this year.")
                                .font(.subheadline).foregroundColor(.secondary)
                        }
                        ForEach(snapshot.candidates) { candidate in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(candidate.learnerId).font(.headline)
                                Text("Grade \(candidate.stage) · \(candidate.academicYear) → \(candidate.nextGrade ?? "School completion")")
                                    .font(.subheadline)
                                HStack(spacing: 8) {
                                    if let nextGrade = candidate.nextGrade {
                                        Button("Promote to \(nextGrade)") {
                                            requestConfirmation(candidate, decision: "promote")
                                        }
                                        .buttonStyle(.borderedProminent)
                                    }
                                    Button("Repeat grade") {
                                        requestConfirmation(candidate, decision: "repeat")
                                    }
                                    .buttonStyle(.bordered)
                                }
                                .disabled(savingId != nil)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(14)
                            .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                        }

                        Text("Recent progression decisions").font(.title3.bold()).accessibilityAddTraits(.isHeader)
                        if snapshot.history.isEmpty {
                            Text("No progression decisions have been recorded.")
                                .font(.subheadline).foregroundColor(.secondary)
                        }
                        ForEach(snapshot.history) { event in
                            VStack(alignment: .leading, spacing: 5) {
                                Text(event.learnerId).font(.headline)
                                Text("Grade \(event.fromGrade) → \(event.toGrade) · \(event.decision.capitalized)")
                                    .font(.subheadline)
                                Text(String(event.approvedAt.prefix(10))).font(.caption).foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(13)
                            .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                .padding(16)
                .frame(maxWidth: 720, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("School progression")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .task { await refresh() }
        .alert(isPresented: Binding(
            get: { pendingCandidate != nil },
            set: { if !$0 { pendingCandidate = nil } }
        )) {
            guard let candidate = pendingCandidate else {
                return Alert(title: Text("Confirm progression"))
            }
            let nextGrade = pendingDecision == "repeat" ? candidate.stage : (candidate.nextGrade ?? candidate.stage)
            let nextYear = (Int(yearText) ?? candidate.academicYear) + 1
            return Alert(
                title: Text("Confirm \(pendingDecision)"),
                message: Text("\(candidate.learnerId): Grade \(candidate.stage) → \(nextGrade) in \(nextYear). This creates a new enrolment and completes the current year. CABO does not decide progression."),
                primaryButton: .default(Text("Confirm decision")) {
                    Task { await submit(candidate, decision: pendingDecision) }
                },
                secondaryButton: .cancel(Text("Cancel")) { pendingCandidate = nil }
            )
        }
    }

    private var validYear: Bool {
        guard let year = Int(yearText) else { return false }
        return (2020...2200).contains(year)
    }

    private func requestConfirmation(_ candidate: NativeSchoolProgressionCandidate, decision: String) {
        guard savingId == nil, decision != "promote" || candidate.nextGrade != nil else { return }
        pendingCandidate = candidate
        pendingDecision = decision
    }

    private func refresh() async {
        guard let year = Int(yearText), (2020...2200).contains(year), !busy, savingId == nil else {
            if !validYear { error = "Enter a current academic year from 2020 to 2200." }
            return
        }
        busy = true
        notice = ""
        error = ""
        defer { busy = false }
        do {
            snapshot = try await session.fetchSchoolProgression(organizationId: organizationId, year: year)
        } catch {
            snapshot = nil
            self.error = "Progression records are unavailable for this account right now. Check your connection and try again."
        }
    }

    private func submit(_ candidate: NativeSchoolProgressionCandidate, decision: String) async {
        guard let year = Int(yearText), (2020...2199).contains(year), savingId == nil else { return }
        savingId = candidate.id
        notice = ""
        error = ""
        defer { savingId = nil }
        do {
            try await session.submitSchoolProgression(
                organizationId: organizationId, candidate: candidate, targetYear: year + 1, decision: decision
            )
            notice = "Learner \(candidate.learnerId) recorded for \(year + 1)."
            snapshot = try await session.fetchSchoolProgression(organizationId: organizationId, year: year)
        } catch {
            self.error = "That progression could not be saved. The enrolment may have changed; refresh and review it again."
            snapshot = try? await session.fetchSchoolProgression(organizationId: organizationId, year: year)
        }
    }
}
