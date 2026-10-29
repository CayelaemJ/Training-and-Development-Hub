import SwiftUI

struct NativeStaffSupportView: View {
    @ObservedObject var session: NativeSession
    let ticket: NativeStaffSupportTicket
    @Environment(\.dismiss) private var dismiss
    @State private var reply = ""
    @State private var triageReason = ""
    @State private var message: String?
    @State private var busy = false
    @State private var activeTicket: NativeStaffSupportTicket
    @State private var educatorId = ""
    @State private var practice = ""
    @State private var reviewDate = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date().addingTimeInterval(86400)
    @State private var statusReason = ""
    @State private var comparisonReason = ""
    @State private var baselineGradeId: Int?
    @State private var followupGradeId: Int?
    @State private var dnaState = "needs_practice"
    @State private var dnaNote = ""

    private var canManage: Bool { ["teacher", "assessor"].contains(session.role ?? "") }

    init(session: NativeSession, ticket: NativeStaffSupportTicket) {
        self.session = session
        self.ticket = ticket
        _activeTicket = State(initialValue: ticket)
    }

    var body: some View {
        NavigationView {
            Form {
                Section {
                    HStack { Text("Status"); Spacer(); Text(activeTicket.status.replacingOccurrences(of: "_", with: " ")).foregroundColor(.secondary) }
                    HStack { Text("Request"); Spacer(); Text("#\(activeTicket.id)").foregroundColor(.secondary) }
                    if let date = activeTicket.reviewAt { Label("Practice review \(date)", systemImage: "calendar") }
                    if let outcome = activeTicket.outcome {
                        Text("Published results: \(outcome.baseline, specifier: "%.1f")% → \(outcome.followup, specifier: "%.1f")% · \(outcome.improvementPp, specifier: "%.1f") percentage points")
                        if let reason = outcome.comparisonReason, !reason.isEmpty { Text(reason).font(.footnote) }
                        Text("Educator-reviewed progress is observed; it does not prove support alone caused the change.")
                            .font(.footnote).foregroundColor(.secondary)
                    }
                    Text("School \(activeTicket.organizationId) · Course \(activeTicket.courseId)")
                        .font(.footnote).foregroundColor(.secondary)
                } header: {
                    Text(ticket.concept)
                }

                Section("Learner request") {
                    Text(activeTicket.question).fixedSize(horizontal: false, vertical: true)
                    Text("What they tried").font(.headline)
                    Text(activeTicket.attempted).fixedSize(horizontal: false, vertical: true)
                }

                if canManage {
                    if let assignee = activeTicket.assignedTo { Text("Assigned educator account: \(assignee)").font(.footnote).foregroundColor(.secondary) }
                    Section("Assign and plan practice") {
                        if !(activeTicket.educators ?? []).isEmpty {
                            Picker("Assigned educator", selection: $educatorId) {
                                Text("Choose an educator").tag("")
                                ForEach(activeTicket.educators ?? []) { educator in
                                    Text([educator.firstName, educator.lastName].compactMap { $0 }.joined(separator: " ").isEmpty
                                         ? "School educator" : [educator.firstName, educator.lastName].compactMap { $0 }.joined(separator: " "))
                                        .tag(educator.id)
                                }
                            }
                            Button("Assign authorised educator") { Task { await assign() } }
                                .disabled(busy || educatorId.isEmpty || educatorId == activeTicket.assignedTo)
                        } else {
                            Text("No additional authorised educators are available for this course.")
                                .font(.subheadline).foregroundColor(.secondary)
                        }
                        TextEditor(text: $practice).frame(minHeight: 80).accessibilityLabel("Practice activity")
                        DatePicker("Review checkpoint", selection: $reviewDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                        Button("Assign practice and checkpoint") { Task { await schedulePractice() } }
                            .disabled(busy || practice.trimmingCharacters(in: .whitespacesAndNewlines).count < 5 || reviewDate <= Date())
                    }
                }

                if activeTicket.status == "open" && canManage {
                    Section("Triage") {
                        TextField("Add a short triage reason", text: $triageReason)
                        Button {
                            Task { await triage() }
                        } label: {
                            if busy { ProgressView() }
                            else { Label("Mark as triaged", systemImage: "checkmark.circle") }
                        }
                        .disabled(busy || triageReason.trimmingCharacters(in: .whitespacesAndNewlines).count < 3)
                    }
                }

                if canManage && activeTicket.status != "open" {
                    let targets = educatorTargets(activeTicket.status)
                    if !targets.isEmpty {
                        Section("Support status") {
                            TextEditor(text: $statusReason).frame(minHeight: 72).accessibilityLabel("Reason for status change")
                            ForEach(targets, id: \.self) { target in
                                let prerequisitesMet = (target != "resolved" || activeTicket.outcome != nil) &&
                                    (target != "closed" || activeTicket.feedback == "helpful") &&
                                    (target != "assigned" || activeTicket.assignedTo != nil) &&
                                    (target != "follow_up_required" || activeTicket.reviewAt != nil)
                                Button("Move to \(target.replacingOccurrences(of: "_", with: " "))") {
                                    Task { await transition(to: target, reason: statusReason) }
                                }.disabled(busy || statusReason.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 || !prerequisitesMet)
                            }
                        }
                    }
                }

                if canManage {
                    Section("Reply to learner") {
                        TextEditor(text: $reply).frame(minHeight: 120)
                        Button {
                            Task { await sendReply() }
                        } label: {
                            if busy { ProgressView() }
                            else { Label("Send reply", systemImage: "paperplane.fill") }
                        }
                        .disabled(busy || reply.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
                    }
                } else if session.role == "learner" {
                    if ["awaiting_learner", "resolved", "closed"].contains(activeTicket.status) {
                        Section("Next step") {
                            Button("I still need more help") {
                                Task { await transition(to: "in_progress", reason: "I still need more help with this topic.") }
                            }.disabled(busy)
                        }
                    }
                    if activeTicket.status == "resolved" && activeTicket.feedback == "helpful" {
                        Section("Close request") {
                            Button("Close this support request") {
                                Task { await transition(to: "closed", reason: "I understand the support provided.") }
                            }.disabled(busy)
                        }
                    }
                    if activeTicket.feedback == nil && !["resolved", "closed"].contains(activeTicket.status) {
                        Section("How did this help?") {
                            Text("Your educator can follow up based on your response.")
                                .font(.subheadline).foregroundColor(.secondary)
                            Button("I understood the help") { Task { await respond("helpful") } }
                                .disabled(busy)
                            Button("I still need help") { Task { await respond("needs_more_help") } }
                                .disabled(busy)
                        }
                    } else if let feedback = activeTicket.feedback {
                        Section("Your response") {
                            Text(feedback == "helpful" ? "You told your educator this helped." : "You asked your educator for more help.")
                        }
                    }
                } else {
                    Section {
                        Text("Your account can review this request but cannot update it. Ask a teacher or assessor assigned to the course.")
                            .font(.subheadline).foregroundColor(.secondary)
                    }
                }

                if canManage && activeTicket.status == "follow_up_required" {
                    Section("Published evidence and Learning DNA") {
                        if activeTicket.publishedResults.count >= 2 {
                            Menu("Initial result · \(resultLabel(baselineGradeId, in: activeTicket))") {
                                ForEach(activeTicket.publishedResults) { result in
                                    Button(resultLabel(result)) { baselineGradeId = result.id }
                                }
                            }
                            Menu("Follow-up result · \(resultLabel(followupGradeId, in: activeTicket))") {
                                ForEach(activeTicket.publishedResults) { result in
                                    Button(resultLabel(result)) { followupGradeId = result.id }
                                }
                            }
                            TextEditor(text: $comparisonReason).frame(minHeight: 80)
                                .accessibilityLabel("Why the published assessment results are comparable")
                            Button("Record comparable evidence") {
                                Task { await recordOutcome() }
                            }.disabled(busy || baselineGradeId == nil || followupGradeId == nil || baselineGradeId == followupGradeId || comparisonReason.trimmingCharacters(in: .whitespacesAndNewlines).count < 20)
                        } else {
                            Text("Two different published results in this subject are needed before progress can be recorded.")
                                .font(.subheadline).foregroundColor(.secondary)
                        }
                        Picker("Learning DNA state", selection: $dnaState) {
                            Text("Needs practice").tag("needs_practice")
                            Text("Demonstrated").tag("demonstrated")
                            Text("Not attempted").tag("not_attempted")
                        }
                        TextEditor(text: $dnaNote).frame(minHeight: 80).accessibilityLabel("Educator concept review")
                        Button("Save Learning DNA review") { Task { await saveDNA() } }
                            .disabled(busy || dnaNote.trimmingCharacters(in: .whitespacesAndNewlines).count < 20 || (dnaState == "demonstrated" && activeTicket.outcome == nil))
                    }
                }

                Section("Request history") {
                    if activeTicket.history.isEmpty { Text("No updates have been recorded yet.").foregroundColor(.secondary) }
                    ForEach(activeTicket.history) { event in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(event.kind.replacingOccurrences(of: "_", with: " ").capitalized).font(.headline)
                            if let state = event.state { Text("Learning DNA · \(state.replacingOccurrences(of: "_", with: " "))").font(.subheadline) }
                            Text(event.body).font(.subheadline)
                            Text(event.createdAt).font(.caption).foregroundColor(.secondary)
                        }.padding(.vertical, 4)
                    }
                }

                if let message {
                    Section { Text(message).font(.subheadline) }
                }
            }
            .navigationTitle("Learner support")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .task { await reloadTicket() }
    }

    private func triage() async {
        busy = true
        defer { busy = false }
        do {
            try await session.triageSupportTicket(activeTicket, reason: triageReason)
            await reloadTicket()
            message = "Request moved to triaged."
        } catch {
            message = error.localizedDescription
        }
    }

    private func sendReply() async {
        busy = true
        defer { busy = false }
        do {
            try await session.replyToSupportTicket(activeTicket, body: reply)
            reply = ""
            await reloadTicket()
            message = "Your reply was added to request history."
        } catch {
            message = error.localizedDescription
        }
    }

    private func reloadTicket() async {
        guard canManage || session.role == "learner" else { return }
        do {
            let latest = try await session.loadStaffSupportTicket(activeTicket)
            activeTicket = latest
            if educatorId.isEmpty { educatorId = latest.assignedTo ?? "" }
        } catch { message = "Could not refresh this request. Close it and retry from the educator queue." }
    }

    private func assign() async {
        busy = true; defer { busy = false }
        do { try await session.assignSupportTicket(activeTicket, staffId: educatorId); await reloadTicket(); message = "Educator assignment saved." }
        catch { message = "Could not assign this request. Refresh and try again." }
    }

    private func schedulePractice() async {
        busy = true; defer { busy = false }
        do { try await session.scheduleSupportPractice(activeTicket, body: practice, date: reviewDate); await reloadTicket(); message = "Practice and review checkpoint saved." }
        catch { message = "Could not save this checkpoint. Choose a future date and retry." }
    }

    private func respond(_ feedback: String) async {
        busy = true; defer { busy = false }
        do {
            try await session.respondToSupportTicket(activeTicket, feedback: feedback)
            await reloadTicket()
            message = feedback == "helpful" ? "Thanks for letting your educator know." : "Your educator will see that you still need help."
        } catch { message = "Could not send your response. Refresh this request and try again." }
    }

    private func transition(to status: String, reason: String) async {
        busy = true; defer { busy = false }
        do {
            try await session.transitionSupportTicket(activeTicket, status: status, reason: reason)
            await reloadTicket()
            message = "Support status updated."
        } catch { message = "This status change could not be saved. Refresh and check the request requirements." }
    }

    private func recordOutcome() async {
        guard let baselineGradeId, let followupGradeId else { return }
        busy = true; defer { busy = false }
        do {
            try await session.recordSupportOutcome(activeTicket, baselineId: baselineGradeId,
                followupId: followupGradeId, reason: comparisonReason)
            await reloadTicket()
            message = "Published assessment comparison saved."
        } catch { message = "The published results could not be compared. Check dates, subject, category and review checkpoint." }
    }

    private func saveDNA() async {
        busy = true; defer { busy = false }
        do {
            try await session.saveLearningDna(activeTicket, state: dnaState, body: dnaNote)
            await reloadTicket()
            message = "Learning DNA review saved."
        } catch { message = "Could not save this concept review. Demonstrated status requires published outcome evidence." }
    }

    private func educatorTargets(_ status: String) -> [String] {
        switch status {
        case "triaged": return ["assigned"]
        case "assigned": return ["in_progress", "triaged"]
        case "in_progress": return ["awaiting_learner", "follow_up_required", "triaged"]
        case "awaiting_learner": return ["in_progress", "follow_up_required"]
        case "follow_up_required": return ["in_progress", "resolved"]
        case "resolved": return ["closed", "in_progress"]
        case "closed": return ["in_progress"]
        default: return []
        }
    }

    private func resultLabel(_ id: Int?, in ticket: NativeStaffSupportTicket) -> String {
        guard let id, let result = ticket.publishedResults.first(where: { $0.id == id }) else { return "Choose a result" }
        return resultLabel(result)
    }

    private func resultLabel(_ result: NativeSupportResult) -> String {
        "\(result.title) · \(String(format: "%.1f", result.marks))/\(String(format: "%.1f", result.maxMarks))"
    }
}
