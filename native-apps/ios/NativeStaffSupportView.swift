import SwiftUI

struct NativeStaffSupportView: View {
    @ObservedObject var session: NativeSession
    let ticket: NativeStaffSupportTicket
    @Environment(\.dismiss) private var dismiss
    @State private var reply = ""
    @State private var triageReason = ""
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        NavigationView {
            Form {
                Section {
                    HStack { Text("Status"); Spacer(); Text(ticket.status.replacingOccurrences(of: "_", with: " ")).foregroundColor(.secondary) }
                    HStack { Text("Request"); Spacer(); Text("#\(ticket.id)").foregroundColor(.secondary) }
                    Text("School \(ticket.organizationId) · Course \(ticket.courseId)")
                        .font(.footnote).foregroundColor(.secondary)
                } header: {
                    Text(ticket.concept)
                }

                Section("Learner request") {
                    Text(ticket.question).fixedSize(horizontal: false, vertical: true)
                    Text("What they tried").font(.headline)
                    Text(ticket.attempted).fixedSize(horizontal: false, vertical: true)
                }

                if ticket.status == "open" {
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
    }

    private func triage() async {
        busy = true
        defer { busy = false }
        do {
            try await session.triageSupportTicket(ticket, reason: triageReason)
            dismiss()
        } catch {
            message = error.localizedDescription
        }
    }

    private func sendReply() async {
        busy = true
        defer { busy = false }
        do {
            try await session.replyToSupportTicket(ticket, body: reply)
            dismiss()
        } catch {
            message = error.localizedDescription
        }
    }
}
