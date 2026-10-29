import SwiftUI
import UIKit

struct NativeLearnerPassportView: View {
    @ObservedObject var session: NativeSession
    @Environment(\.dismiss) private var dismiss
    @State private var shareText: String?
    @State private var sharePresented = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Your private learning progress")
                        .font(.title2.bold())
                    Text("This account-bound view includes educator-reviewed support progress and published result comparisons. Conversations, staff contact details, and unreviewed narratives are excluded.")
                        .font(.subheadline).foregroundColor(.secondary)
                    HStack(spacing: 12) {
                        Button {
                            Task { await session.refreshLearnerPassport() }
                        } label: {
                            Label(session.learnerPassportBusy ? "Loading…" : "Refresh", systemImage: "arrow.clockwise")
                                .frame(maxWidth: .infinity, minHeight: 46)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(session.learnerPassportBusy)
                        Button {
                            shareText = session.learnerPassportJSON
                            sharePresented = shareText != nil
                        } label: {
                            Label("Export JSON", systemImage: "square.and.arrow.up")
                                .frame(maxWidth: .infinity, minHeight: 46)
                        }
                        .buttonStyle(.bordered)
                        .disabled(session.learnerPassportBusy || session.learnerPassportJSON == nil)
                    }
                    if session.learnerPassportBusy { ProgressView("Loading private records…") }
                    if !session.learnerPassportNotice.isEmpty {
                        Text(session.learnerPassportNotice)
                            .font(.footnote).foregroundColor(.secondary)
                    }
                    if let passport = session.learnerPassport {
                        Text("Updated \(String(passport.asOf.prefix(10)))")
                            .font(.caption).foregroundColor(.secondary)
                        Text("Support progress").font(.title3.bold())
                        if passport.items.isEmpty {
                            passportCard("No support progress yet",
                                detail: "Educator-reviewed support records and published result comparisons will appear here.")
                        }
                        ForEach(passport.items) { item in
                            VStack(alignment: .leading, spacing: 7) {
                                Text(item.concept).font(.headline)
                                Text("Status · \(item.status.replacingOccurrences(of: "_", with: " "))")
                                    .font(.subheadline)
                                if let outcome = item.outcome {
                                    Text("Published results · \(outcome.baseline.formatted())% to \(outcome.followup.formatted())%")
                                        .font(.subheadline)
                                    let change = outcome.improvementPp >= 0
                                        ? "+\(outcome.improvementPp.formatted())"
                                        : outcome.improvementPp.formatted()
                                    Text("\(change) percentage points · observed progress, not proof of cause")
                                        .font(.footnote).foregroundColor(.secondary)
                                }
                            }
                            .padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
                        }
                        Text("Learning DNA · educator reviewed").font(.title3.bold())
                        if passport.learningDNA.isEmpty {
                            passportCard("No reviewed learning evidence",
                                detail: "Educator-reviewed concept evidence appears here when available.")
                        }
                        ForEach(passport.learningDNA) { evidence in
                            passportCard(evidence.concept,
                                detail: "Reviewed state · \(evidence.state.replacingOccurrences(of: "_", with: " "))")
                        }
                        Text(passport.provenance).font(.footnote).foregroundColor(.secondary)
                        Text(passport.interpretation).font(.footnote).foregroundColor(.secondary)
                    }
                }
                .padding(20)
                .frame(maxWidth: 760, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("Learner passport")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .task {
            if session.learnerPassport == nil { await session.refreshLearnerPassport() }
        }
        .sheet(isPresented: $sharePresented) {
            if let shareText {
                NativePassportActivitySheet(text: shareText)
            }
        }
    }

    private func passportCard(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.headline)
            Text(detail).font(.subheadline).foregroundColor(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct NativePassportActivitySheet: UIViewControllerRepresentable {
    let text: String

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [text], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
