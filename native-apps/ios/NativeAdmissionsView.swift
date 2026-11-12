import SwiftUI

struct NativeAdmissionsView: View {
    @ObservedObject var session: NativeSession
    @Environment(\.dismiss) private var dismiss
    @State private var institutionId: Int?
    @State private var programmeId: Int?
    @State private var statement = ""
    @State private var references: [Int: String] = [:]

    private var selectedInstitution: NativeAdmissionInstitution? {
        session.admissionInstitutions.first { $0.id == institutionId }
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("CABO Apply")
                        .font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                    Text("Browse listed programmes and keep a private record of your application steps. CABO does not submit applications to universities or verify decisions.")
                        .font(.subheadline).foregroundColor(.secondary)

                    if !session.admissionsNotice.isEmpty {
                        Text(session.admissionsNotice).font(.footnote).foregroundColor(.secondary)
                            .accessibilityIdentifier("admissions-notice")
                    }
                    Button("Refresh applications and institutions") { Task { await session.refreshAdmissions(institutionId: institutionId) } }
                        .buttonStyle(.bordered).disabled(session.admissionsBusy)

                    GroupBox("Institution directory") {
                        VStack(alignment: .leading, spacing: 10) {
                            if session.admissionInstitutions.isEmpty {
                                Text("No institutions are currently listed.").foregroundColor(.secondary)
                            }
                            ForEach(session.admissionInstitutions) { institution in
                                Button {
                                    institutionId = institution.id
                                    programmeId = nil
                                    Task { await session.loadAdmissionProgrammes(institutionId: institution.id) }
                                } label: {
                                    HStack(alignment: .top) {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(institution.name).font(.headline)
                                            Text("\(institution.province ?? "Location not provided") · \(institution.verification.replacingOccurrences(of: "_", with: " "))")
                                                .font(.caption).foregroundColor(.secondary)
                                        }
                                        Spacer()
                                        if institutionId == institution.id { Image(systemName: "checkmark.circle.fill") }
                                    }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                                }.buttonStyle(.plain)
                            }
                            if let url = selectedInstitution?.officialUrl, URL(string: url)?.scheme == "https" {
                                Link("Open institution's official portal", destination: URL(string: url)!)
                                    .font(.subheadline)
                            }
                        }.frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if institutionId != nil {
                        GroupBox("Published programmes") {
                            VStack(alignment: .leading, spacing: 10) {
                                if session.admissionsBusy && session.admissionProgrammes.isEmpty { ProgressView("Loading programmes…") }
                                if session.admissionProgrammes.isEmpty && !session.admissionsBusy {
                                    Text("No published programmes are listed for this institution.").foregroundColor(.secondary)
                                }
                                ForEach(session.admissionProgrammes) { programme in
                                    Button { programmeId = programme.id } label: {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(programme.name).font(.headline)
                                                Text([programme.qualification, programme.faculty].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                                                    .font(.caption).foregroundColor(.secondary)
                                                if let requirements = programme.requirements, !requirements.isEmpty {
                                                    Text(requirements).font(.footnote).foregroundColor(.secondary)
                                                }
                                            }
                                            Spacer(); if programmeId == programme.id { Image(systemName: "checkmark.circle.fill") }
                                        }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                                    }.buttonStyle(.plain)
                                }
                            }.frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }

                    if let programmeId {
                        GroupBox("Start a private draft") {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Your statement is saved to your CABO account. Do not enter identity numbers, health information, or other sensitive details.")
                                    .font(.footnote).foregroundColor(.secondary)
                                TextEditor(text: $statement).frame(minHeight: 110).accessibilityLabel("Application statement")
                                Text("\(statement.utf8.count) / 4000 bytes").font(.caption).foregroundColor(.secondary)
                                Button("Create private draft") {
                                    Task { await session.createAdmissionDraft(programmeId: programmeId, statement: statement, institutionId: institutionId) }
                                }.buttonStyle(.borderedProminent)
                                    .disabled(session.admissionsBusy || statement.utf8.count > 4000)
                            }.frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }

                    GroupBox("My application tracker") {
                        VStack(alignment: .leading, spacing: 14) {
                            if session.admissionApplications.isEmpty { Text("No applications started.").foregroundColor(.secondary) }
                            ForEach(session.admissionApplications) { application in
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(session.admissionProgrammes.first { $0.id == application.programmeId }?.name ?? "Programme #\(application.programmeId)")
                                        .font(.headline)
                                    Text("Status: \(application.status.replacingOccurrences(of: "_", with: " "))")
                                        .font(.subheadline)
                                    if let reference = application.externalReference, !reference.isEmpty {
                                        Text("Reference recorded: \(reference)").font(.footnote).foregroundColor(.secondary)
                                    }
                                    if application.status == "draft" {
                                        Button("Mark ready for official handoff") {
                                            Task { await session.updateAdmission(applicationId: application.id, status: "ready_for_handoff", institutionId: institutionId) }
                                        }.buttonStyle(.bordered).disabled(session.admissionsBusy)
                                    } else if application.status == "ready_for_handoff" {
                                        TextField("Official portal confirmation reference", text: Binding(
                                            get: { references[application.id, default: ""] },
                                            set: { references[application.id] = String($0.prefix(150)) }
                                        )).textFieldStyle(.roundedBorder).textInputAutocapitalization(.never)
                                        Button("Record external submission") {
                                            Task { await session.updateAdmission(applicationId: application.id, status: "external_submission_recorded", externalReference: references[application.id], institutionId: institutionId) }
                                        }.buttonStyle(.bordered).disabled(session.admissionsBusy || (references[application.id]?.trimmingCharacters(in: .whitespacesAndNewlines).count ?? 0) < 3)
                                    }
                                    if ["draft", "ready_for_handoff", "external_submission_recorded", "under_review"].contains(application.status) {
                                        Button("Withdraw tracker record", role: .destructive) {
                                            Task { await session.updateAdmission(applicationId: application.id, status: "withdrawn", institutionId: institutionId) }
                                        }.buttonStyle(.bordered).disabled(session.admissionsBusy)
                                    }
                                    Text("A recorded reference is self-reported. CABO has not verified submission or an institution decision.")
                                        .font(.caption).foregroundColor(.secondary)
                                }
                                if application.id != session.admissionApplications.last?.id { Divider() }
                            }
                        }.frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(16).frame(maxWidth: 760, alignment: .leading).frame(maxWidth: .infinity)
            }
            .navigationTitle("University applications")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .navigationBarTrailing) { Button("Done") { dismiss() } } }
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .task { if session.admissionInstitutions.isEmpty { await session.refreshAdmissions() } }
    }
}
