import SwiftUI

struct NativeMaterialUploadSelection: Identifiable {
    let id = UUID()
    let url: URL
    let suggestedTitle: String
}

struct NativeMaterialUploadView: View {
    @ObservedObject var session: NativeSession
    let selection: NativeMaterialUploadSelection
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var busy = false
    @State private var message: String?
    @State private var succeeded = false

    init(session: NativeSession, selection: NativeMaterialUploadSelection) {
        self.session = session
        self.selection = selection
        _title = State(initialValue: selection.suggestedTitle)
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Study material") {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("Selected file").font(.caption).foregroundColor(.secondary)
                        Text(selection.url.lastPathComponent).font(.body).lineLimit(2)
                    }
                    TextField("Material title", text: $title)
                        .textInputAutocapitalization(.sentences)
                        .accessibilityLabel("Study material title")
                    Text("PDF, Office, text, CSV and image files up to 30 MB.")
                        .font(.footnote).foregroundColor(.secondary)
                }

                Section {
                    Label("Only your CABO account can access this material.", systemImage: "lock.shield")
                    Text("The upload is sent securely to CABO. The app does not keep an offline copy or enable AI reading.")
                        .font(.footnote).foregroundColor(.secondary)
                }

                if let message {
                    Section {
                        Text(message)
                            .font(.subheadline)
                            .foregroundColor(succeeded ? .green : .red)
                            .accessibilityAddTraits(.isStaticText)
                    }
                }
            }
            .navigationTitle("Add study material")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.disabled(busy)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(succeeded ? "Done" : busy ? "Uploading…" : "Upload") {
                        if succeeded { dismiss() }
                        else { Task { await upload() } }
                    }
                    .disabled(busy || (!succeeded && (title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || title.count > 200)))
                }
            }
            .overlay {
                if busy { ProgressView("Uploading to CABO…") }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
    }

    @MainActor
    private func upload() async {
        guard !busy else { return }
        busy = true
        message = nil
        succeeded = false
        defer { busy = false }
        do {
            try await session.uploadMaterial(fileURL: selection.url, title: title)
            await session.refresh()
            succeeded = true
            message = "Your study material is available in CABO."
        } catch {
            message = error.localizedDescription
        }
    }
}
