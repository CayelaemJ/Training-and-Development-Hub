import SwiftUI
import UIKit

private enum PassportDeletion {
    case link(Int)
    case skill(Int)
}

struct NativeLearnerPassportView: View {
    @ObservedObject var session: NativeSession
    @Environment(\.dismiss) private var dismiss
    @State private var shareText: String?
    @State private var sharePresented = false
    @State private var learningContext = "lifelong"
    @State private var preferredLanguage = ""
    @State private var learningGoal = ""
    @State private var evidenceProvider = ""
    @State private var evidenceURL = ""
    @State private var evidenceDescription = ""
    @State private var evidenceType = "portfolio"
    @State private var skill = ""
    @State private var skillCategory = "technical"
    @State private var masteryLevel = 0
    @State private var demonstration = "practical"
    @State private var skillDescription = ""
    @State private var evidenceLinkId: Int?
    @State private var pendingDelete: PassportDeletion?

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
                            if let json = session.learnerPassportJSON {
                                shareText = json
                                sharePresented = true
                            }
                        } label: {
                            Label("Export JSON", systemImage: "square.and.arrow.up")
                                .frame(maxWidth: .infinity, minHeight: 46)
                        }
                        .buttonStyle(.bordered)
                        .disabled(session.learnerPassportBusy || session.learnerPassportJSON == nil)
                    }
                    lifelongPassportSection
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
            if session.lifelongPassport == nil { await session.refreshLifelongPassport() }
            if let preferences = session.lifelongPassport?.preferences {
                learningContext = preferences.learningContext
                preferredLanguage = preferences.preferredLanguage
                learningGoal = preferences.learningGoal
            }
        }
        .sheet(isPresented: $sharePresented) {
            if let shareText {
                NativePassportActivitySheet(text: shareText)
            }
        }
        .onChange(of: session.lifelongPassport?.preferences.learningContext) { _ in
            guard let preferences = session.lifelongPassport?.preferences else { return }
            learningContext = preferences.learningContext
            preferredLanguage = preferences.preferredLanguage
            learningGoal = preferences.learningGoal
        }
        .onChange(of: session.lifelongPassport?.links.map(\.id)) { ids in
            if let evidenceLinkId, !(ids ?? []).contains(evidenceLinkId) {
                self.evidenceLinkId = nil
            }
        }
        .alert("Remove this private item?", isPresented: Binding(
            get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }
        )) {
            Button("Remove", role: .destructive) {
                guard let pendingDelete else { return }
                Task {
                    switch pendingDelete {
                    case .link(let id): await session.deleteLifelongEvidenceLink(id: id)
                    case .skill(let id): await session.deleteLifelongCompetency(id: id)
                    }
                }
                self.pendingDelete = nil
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: {
            Text("This only removes your self-reported item from your private Learning Passport. It does not affect school or official records.")
        }
    }

    private var lifelongPassportSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("My Learning Passport").font(.title2.bold())
            Text("Keep your learning goals, practical skills and public evidence links in one private record. Skills and links are self-reported; they are not verified certificates, official qualifications, or measures of intelligence or potential.")
                .font(.subheadline).foregroundColor(.secondary)
            Button {
                Task { await session.refreshLifelongPassport() }
            } label: {
                Label(session.lifelongPassportBusy ? "Loading…" : "Refresh Learning Passport", systemImage: "arrow.clockwise")
                    .frame(maxWidth: .infinity, minHeight: 46)
            }
            .buttonStyle(.bordered)
            .disabled(session.lifelongPassportBusy)
            if !session.lifelongPassportNotice.isEmpty {
                Text(session.lifelongPassportNotice).font(.footnote).foregroundColor(.secondary)
            }

            GroupBox("Learning preferences") {
                VStack(alignment: .leading, spacing: 12) {
                    Picker("Learning context", selection: $learningContext) {
                        Text("Lifelong personal learning").tag("lifelong")
                        Text("Returning to education as an adult").tag("adult_returning")
                        Text("Preparing for a career change").tag("career_change")
                        Text("Professional development").tag("professional")
                        Text("School learning").tag("school")
                        Text("Independent learning").tag("personal")
                    }
                    .pickerStyle(.menu)
                    TextField("Preferred language (optional)", text: $preferredLanguage)
                        .textFieldStyle(.roundedBorder).textInputAutocapitalization(.words)
                        .onChange(of: preferredLanguage) { preferredLanguage = String($0.prefix(24)) }
                    Text("What would you like to learn, complete or become?").font(.subheadline)
                    TextEditor(text: $learningGoal).frame(minHeight: 76).overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator)))
                        .onChange(of: learningGoal) { learningGoal = String($0.prefix(2000)) }
                    Button("Save preferences") {
                        Task { await session.saveLifelongPreferences(.init(learningContext: learningContext,
                            preferredLanguage: preferredLanguage, learningGoal: learningGoal)) }
                    }
                    .buttonStyle(.borderedProminent).disabled(session.lifelongPassportBusy)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            GroupBox("External evidence and connections") {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Add a public HTTPS portfolio or project link. It stays private in your account and is not scanned or shared with employers.")
                        .font(.footnote).foregroundColor(.secondary)
                    if let links = session.lifelongPassport?.links, !links.isEmpty {
                        ForEach(links) { link in
                            VStack(alignment: .leading, spacing: 5) {
                                Text("\(link.provider) · \(link.evidenceType.replacingOccurrences(of: "_", with: " ")) · self-reported").font(.headline)
                                Text(link.url).font(.footnote).foregroundColor(.secondary).textSelection(.enabled)
                                if !link.description.isEmpty { Text(link.description).font(.subheadline) }
                                Button("Remove link", role: .destructive) { pendingDelete = .link(link.id) }
                                    .disabled(session.lifelongPassportBusy)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(12)
                            .background(Color(UIColor.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                        }
                    } else {
                        Text("No links added yet.").font(.footnote).foregroundColor(.secondary)
                    }
                    TextField("Website or platform", text: $evidenceProvider).textFieldStyle(.roundedBorder)
                    Picker("Evidence type", selection: $evidenceType) {
                        ForEach(["portfolio", "project", "social", "learning", "community", "other"], id: \.self) { Text($0.replacingOccurrences(of: "_", with: " ")).tag($0) }
                    }.pickerStyle(.menu)
                    TextField("Public HTTPS address", text: $evidenceURL).textFieldStyle(.roundedBorder)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    TextField("What does this demonstrate?", text: $evidenceDescription)
                        .textFieldStyle(.roundedBorder)
                    Button("Add evidence link") {
                        Task {
                            await session.addLifelongEvidenceLink(provider: evidenceProvider, url: evidenceURL,
                                description: evidenceDescription, evidenceType: evidenceType)
                            if session.lifelongPassportNotice == "Private evidence link added." {
                                evidenceProvider = ""; evidenceURL = ""; evidenceDescription = ""
                            }
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(session.lifelongPassportBusy || evidenceProvider.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 || !evidenceURL.lowercased().hasPrefix("https://"))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            GroupBox("Practical skills I can demonstrate") {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Describe work you really completed. The level applies only to the evidence for that skill and is not a judgement of your ability.")
                        .font(.footnote).foregroundColor(.secondary)
                    if let skills = session.lifelongPassport?.competencies, !skills.isEmpty {
                        ForEach(skills) { item in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(item.skill).font(.headline)
                                Text("\(item.category) · \(masteryLabels[min(max(item.masteryLevel, 0), 4)]) · self-reported")
                                    .font(.footnote).foregroundColor(.secondary)
                                Text(item.description).font(.subheadline)
                                Text("Demonstrated through \(item.demonstration.replacingOccurrences(of: "_", with: " "))")
                                    .font(.footnote).foregroundColor(.secondary)
                                Button("Remove skill", role: .destructive) { pendingDelete = .skill(item.id) }
                                    .disabled(session.lifelongPassportBusy)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(12)
                            .background(Color(UIColor.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                        }
                    } else {
                        Text("No practical skills recorded yet.").font(.footnote).foregroundColor(.secondary)
                    }
                    TextField("Skill", text: $skill).textFieldStyle(.roundedBorder)
                    Picker("Skill category", selection: $skillCategory) {
                        ForEach(["technical", "academic", "creative", "vocational", "transferable", "other"], id: \.self) { Text($0).tag($0) }
                    }.pickerStyle(.menu)
                    Picker("Evidence-based self-assessment", selection: $masteryLevel) {
                        ForEach(0..<masteryLabels.count, id: \.self) { Text(masteryLabels[$0]).tag($0) }
                    }.pickerStyle(.menu)
                    Picker("How did you demonstrate it?", selection: $demonstration) {
                        ForEach(["practical", "project", "assessment", "portfolio", "work_example", "reflection", "other"], id: \.self) { Text($0.replacingOccurrences(of: "_", with: " ")).tag($0) }
                    }.pickerStyle(.menu)
                    if let links = session.lifelongPassport?.links, !links.isEmpty {
                        Picker("Supporting external evidence (optional)", selection: $evidenceLinkId) {
                            Text("No linked evidence").tag(Int?.none)
                            ForEach(links) { Text(linkLabel($0)).tag(Optional($0.id)) }
                        }.pickerStyle(.menu)
                    }
                    Text("What did you make, solve, do or explain?").font(.subheadline)
                    TextEditor(text: $skillDescription).frame(minHeight: 100)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator)))
                    Button("Record skill evidence") {
                        Task {
                            await session.addLifelongCompetency(skill: skill, category: skillCategory,
                                masteryLevel: masteryLevel, demonstration: demonstration,
                                description: skillDescription, evidenceLinkId: evidenceLinkId)
                            if session.lifelongPassportNotice == "Practical skill evidence recorded privately." {
                                skill = ""; skillDescription = ""; evidenceLinkId = nil
                            }
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(session.lifelongPassportBusy || skill.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 || skillDescription.trimmingCharacters(in: .whitespacesAndNewlines).count < 10)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .onAppear {
            if let preferences = session.lifelongPassport?.preferences {
                learningContext = preferences.learningContext
                preferredLanguage = preferences.preferredLanguage
                learningGoal = preferences.learningGoal
            }
        }
    }

    private var masteryLabels: [String] {
        ["0 · Not yet demonstrated (not a judgement of ability)", "1 · Exploring with guidance",
         "2 · Developing with some assistance", "3 · Independent demonstration",
         "4 · Applies the skill in new situations"]
    }

    private func linkLabel(_ link: NativePassportEvidenceLink) -> String {
        "\(link.provider) · \(link.url.prefix(48))"
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
