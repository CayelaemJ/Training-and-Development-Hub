import SwiftUI

struct NativeMaterialSummary: Decodable, Identifiable {
    let id: Int
    let title: String
}

struct NativeMaterialPage: Decodable {
    let id: Int
    let title: String
    let text: String
    let offset: Int
    let nextOffset: Int?
    let totalCharacters: Int
}

// Server extracts readable pages for the signed-in account only. No local
// cache of private school records; no background download or external links.
struct NativeMaterialView: View {
    @ObservedObject var session: NativeSession
    let item: NativeMaterialSummary
    @Environment(\.dismiss) private var dismiss
    @State private var content = ""
    @State private var nextOffset: Int? = 0
    @State private var busy = false
    @State private var message: String?

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(item.title).font(.title2.bold()).accessibilityAddTraits(.isHeader)
                    Text("Private study content · Read online")
                        .font(.subheadline).foregroundColor(.secondary)
                    if busy { ProgressView("Opening learning material…") }
                    if let message { Text(message).font(.subheadline).foregroundColor(.secondary) }
                    if !content.isEmpty {
                        Text(content).font(.body).textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if nextOffset != nil && !busy {
                        Button(content.isEmpty ? "Try opening material" : "Read next section") {
                            Task { await loadNext() }
                        }
                        .buttonStyle(.borderedProminent).controlSize(.large)
                    }
                    if !content.isEmpty && nextOffset == nil {
                        Text("End of available material.").font(.footnote)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .frame(maxWidth: 740, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("Study material")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .task { await loadNext() }
    }

    private func loadNext() async {
        guard !busy, let offset = nextOffset else { return }
        busy = true
        defer { busy = false }
        do {
            let page = try await session.loadMaterialPreview(id: item.id, offset: offset)
            guard page.id == item.id, page.offset == offset,
                  page.nextOffset == nil || page.nextOffset! > offset else {
                message = "Material pagination was interrupted. Reopen this material."
                nextOffset = nil
                return
            }
            content += page.text
            nextOffset = page.nextOffset
            message = nil
        } catch {
            message = "Could not open this material. It may require a compatible text-based document or an internet connection."
        }
    }
}
