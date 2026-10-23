import SwiftUI

struct NativeSupportTicket: Identifiable {
    let id: Int
    let organizationId: Int
    let concept: String
    let status: String
    let version: Int
}

// Human educator reply only. No AI-generated text is automatically sent.
struct NativeSupportReplyView: View {
    @ObservedObject var session: NativeSession
    let ticket: NativeSupportTicket
    @Environment(\.dismiss) private var dismiss
    @State private var draft = ""
    @State private var sending = false
    @State private var attempted = false
    @State private var message: String?

    private var eligible: Bool {
        let size = draft.trimmingCharacters(in: .whitespacesAndNewlines).count
        return size >= 2 && size <= 4000
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(ticket.concept).font(.title2.bold()).accessibilityAddTraits(.isHeader)
                    Text("Ticket #\(ticket.id) · \(ticket.status)")
                        .font(.subheadline).foregroundColor(.secondary)
                    Text("Write your own educator reply. CABO will record it in the school's learning support history.")
                    TextEditor(text: $draft)
                        .frame(height: 190)
                        .border(Color.secondary.opacity(0.4), width: 1)
                        .disabled(attempted)
                        .accessibilityLabel("Educator reply")
                    Text("\(draft.count) / 4,000 characters")
                        .font(.footnote).foregroundColor(.secondary)
                    if let message { Text(message).font(.subheadline) }
                    if sending { ProgressView("Sending secure reply…") }
                    Button("Send educator reply") {
                        guard eligible, !attempted, !sending else { return }
                        attempted = true
                        sending = true
                        Task {
                            let ok = await session.replyToTicket(ticket, body: draft)
                            sending = false
                            message = ok
                                ? "Reply saved by CABO."
                                : "Reply status could not be confirmed. Refresh the ticket history before another attempt."
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!eligible || attempted || sending)
                    Text("An interrupted request must not be blindly resent. The server checks the ticket's version to prevent duplicates.")
                        .font(.footnote).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: 680, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("Learner support")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") { dismiss() }.disabled(sending)
                }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
    }
}
