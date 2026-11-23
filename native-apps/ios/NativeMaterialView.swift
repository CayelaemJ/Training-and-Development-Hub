import SwiftUI
import UIKit

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
                    Divider().padding(.vertical, 4)
                    NativeMaterialTutorSection(session: session, materialId: item.id)
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

// Grounded tutor for one owned material. Questions and answers stay in memory
// for this sign-in; the backend decides access and calls the AI provider.
struct NativeMaterialTutorSection: View {
    @ObservedObject var session: NativeSession
    let materialId: Int
    @State private var question = ""
    @State private var asking = false
    @State private var errorMessage: String?
    @FocusState private var questionFocused: Bool

    private var history: [NativeTutorExchange] { session.materialAnswers[materialId] ?? [] }
    private var canAsk: Bool { !asking && NativeMaterialTutor.validatedQuestion(question) != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ask about this material").font(.headline).accessibilityAddTraits(.isHeader)
            Text(NativeMaterialTutor.guidance).font(.footnote).foregroundColor(.secondary)

            ZStack(alignment: .topLeading) {
                TextEditor(text: $question)
                    .frame(minHeight: 88)
                    .focused($questionFocused)
                    .accessibilityLabel("Your question about this material")
                    .onChange(of: question) { value in
                        if value.count > NativeMaterialTutor.questionLimits.upperBound {
                            question = String(value.prefix(NativeMaterialTutor.questionLimits.upperBound))
                        }
                    }
                // Drawn above the editor because TextEditor is opaque on iOS 15.
                if question.isEmpty {
                    Text("For example: What are the main causes described in section 2?")
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 5).padding(.vertical, 8)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .padding(6)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.4)))

            HStack {
                Text("\(question.count)/\(NativeMaterialTutor.questionLimits.upperBound)")
                    .font(.caption).foregroundColor(.secondary)
                    .accessibilityLabel("\(question.count) of \(NativeMaterialTutor.questionLimits.upperBound) characters")
                Spacer()
                Button(asking ? "Asking…" : "Ask the tutor") { Task { await ask() } }
                    .buttonStyle(.borderedProminent)
                    .disabled(!canAsk)
            }
            if asking {
                ProgressView("Finding passages and preparing an answer…")
                    .accessibilityLabel("The tutor is preparing an answer")
            }
            if let errorMessage {
                Text(errorMessage).font(.subheadline).foregroundColor(.red)
                    .accessibilityLabel("Tutor problem: \(errorMessage)")
            }
            ForEach(history.reversed()) { exchange in
                NativeTutorExchangeView(exchange: exchange)
            }
        }
    }

    private func ask() async {
        guard canAsk else { return }
        asking = true
        errorMessage = nil
        defer { asking = false }
        do {
            try await session.askMaterial(id: materialId, question: question)
            question = ""
            questionFocused = false
        } catch {
            errorMessage = NativeMaterialTutor.message(for: error)
        }
    }
}

struct NativeTutorExchangeView: View {
    let exchange: NativeTutorExchange

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("You asked").font(.caption.bold()).foregroundColor(.secondary)
            Text(exchange.question).font(.subheadline).textSelection(.enabled)
            Text("Tutor answer").font(.caption.bold()).foregroundColor(.secondary)
            Text(exchange.answer.answer).font(.body).textSelection(.enabled)
            Text("From your material").font(.caption.bold()).foregroundColor(.secondary)
            ForEach(Array(exchange.answer.citations.enumerated()), id: \.offset) { index, citation in
                Text("“\(citation.excerpt)”")
                    .font(.callout.italic())
                    .padding(.leading, 10)
                    .overlay(Rectangle().frame(width: 3).foregroundColor(.orange), alignment: .leading)
                    .accessibilityLabel("Quote \(index + 1) from your material: \(citation.excerpt)")
            }
            Label("Check this answer against your notes. AI answers can be wrong.",
                  systemImage: "exclamationmark.bubble")
                .font(.caption).foregroundColor(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(10)
        .accessibilityElement(children: .contain)
    }
}
