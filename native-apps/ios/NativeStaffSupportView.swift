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
                } else {
                    Section {
                        Text("Your account can review this request but cannot update it. Ask a teacher or assessor assigned to the course.")
                            .font(.subheadline).foregroundColor(.secondary)
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
            dismiss()
        } catch {
            message = error.localizedDescription
        }
    }

    private func sendReply() async {
        busy = true
        defer { busy = false }
        do {
            try await session.replyToSupportTicket(activeTicket, body: reply)
            dismiss()
        } catch {
            message = error.localizedDescription
        }
    }

    private func reloadTicket() async {
        guard canManage else { return }
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
}
