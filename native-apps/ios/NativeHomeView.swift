import SwiftUI

// Fully native role-based SwiftUI. Uses NavigationView for iOS 15 support,
// a sidebar + content pane on iPad and a single touch-first view on iPhone.
struct NativeHomeView: View {
    @StateObject private var session = NativeSession()
    @State private var selectedQuiz: NativeQuizSummary?
    @State private var selectedMaterial: NativeMaterialSummary?
    @Environment(\.horizontalSizeClass) private var sizeClass
    private let clay = Color(red: 196.0 / 255.0, green: 103.0 / 255.0, blue: 58.0 / 255.0)

    private var isEducator: Bool {
        guard let role = session.role else { return false }
        return ["teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head"]
            .contains(role)
    }

    var body: some View {
        NavigationView {
            Group {
                if sizeClass == .regular {
                    HStack(spacing: 0) {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 18) {
                                sessionControls
                                Text("Optimized for classroom tablets")
                                    .font(.footnote).foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(20)
                        }
                        .frame(minWidth: 210, idealWidth: 270, maxWidth: 300)
                        .background(Color(UIColor.secondarySystemBackground))

                        Divider()
                        mainScroll
                    }
                } else {
                    mainScroll
                }
            }
            .navigationTitle("CABO Learning Hub")
            .navigationBarTitleDisplayMode(.inline)
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .tint(clay)
        .task { await session.restore() }
        .sheet(item: $selectedQuiz) { quiz in
            NativeQuizView(session: session, item: quiz)
        }
        .sheet(item: $selectedMaterial) { material in
            NativeMaterialView(session: session, item: material)
        }
    }

    private var mainScroll: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                if sizeClass != .regular { sessionControls }
                roleContent
                Text("Private records are requested securely when online. Nothing is saved as a private offline learning cache.")
                    .font(.footnote).foregroundColor(.secondary)
            }
            .padding(16)
            .frame(maxWidth: 880, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
    }

    private var sessionControls: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("CABO").font(.title.bold()).foregroundColor(clay)
            Text(session.status).font(.subheadline).foregroundColor(.secondary)
            if session.busy { ProgressView("Connecting…") }
            if session.role == nil {
                Button("Sign in securely") { session.signIn() }
                    .buttonStyle(.borderedProminent).disabled(session.busy)
                    .controlSize(.large)
                Text("Sign in to access learning and family services. A pending invitation never grants child-record access.")
                    .font(.footnote)
            } else {
                HStack(spacing: 12) {
                    Button("Refresh") { Task { await session.refresh() } }
                        .buttonStyle(.borderedProminent).disabled(session.busy)
                    Button("Sign out", role: .destructive) {
                        Task { await session.signOut() }
                    }.buttonStyle(.bordered).disabled(session.busy)
                }.controlSize(.large)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var roleContent: some View {
        if session.role == nil {
            title("CABO for everyone")
            infoTile("Teachers", "Teaching assignments and intervention progress on tablets.", system: "rectangle.3.group")
            infoTile("Learners", "Materials, practice tests and progress on tablets or phones.", system: "book")
            infoTile("Parents", "Simple family invitations and verified links on phones.", system: "person.2")
        } else if session.role == "parent" {
            parentContent
        } else if isEducator {
            educatorContent
        } else {
            learnerContent
        }
    }

    @ViewBuilder
    private var parentContent: some View {
        title("My family")
        Text(session.guardianGuidance)
            .font(.subheadline).foregroundColor(.secondary)
        if session.guardians.isEmpty {
            infoTile("No invitations yet", "A learner can invite your account through CABO.", system: "envelope")
        }
        ForEach(session.guardians) { invite in
            VStack(alignment: .leading, spacing: 12) {
                Text(invite.learnerName ?? "Private learner invitation")
                    .font(.headline)
                Text(guardianExplanation(invite)).font(.subheadline)
                if invite.status == "pending" {
                    HStack {
                        Button("Accept") {
                            Task { await session.decideGuardian(invitationId: invite.id, accept: true) }
                        }
                        .buttonStyle(.borderedProminent).disabled(session.busy)
                        Button("Decline", role: .destructive) {
                            Task { await session.decideGuardian(invitationId: invite.id, accept: false) }
                        }
                        .buttonStyle(.bordered).disabled(session.busy)
                    }
                    .controlSize(.large)
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
        }
    }

    @ViewBuilder
    private var educatorContent: some View {
        title("Teaching & learner support")
        if session.staffSchools.isEmpty {
            infoTile("No school assignments", "Your administrator can set up your assigned classes.", system: "person.crop.rectangle")
        }
        ForEach(session.staffSchools) { school in
            VStack(alignment: .leading, spacing: 8) {
                Text("School workspace \(school.id)").font(.headline)
                if let notice = school.notice { Text(notice).font(.subheadline) }
                if school.subjects.isEmpty {
                    Text("No assigned subjects available.").foregroundColor(.secondary)
                }
                ForEach(school.subjects, id: \.self) { subject in
                    Label(subject, systemImage: "book.closed")
                }
                if !school.support.isEmpty {
                    Text("Learning support").font(.headline).padding(.top, 8)
                    ForEach(school.support, id: \.self) { item in Text(item) }
                }
                if !school.tickets.isEmpty {
                    Text("Learner help requests").font(.headline).padding(.top, 8)
                    ForEach(school.tickets, id: \.self) { ticket in
                        Label(ticket, systemImage: "person.crop.circle.badge.questionmark")
                    }
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
        }
        Text("Teacher marking and support actions are being developed after device authentication tests.")
            .font(.footnote).foregroundColor(.secondary)
    }

    @ViewBuilder
    private var learnerContent: some View {
        title("My learning journey")
        ForEach(session.summary + session.journey, id: \.self) { item in
            infoTile(item, "Current CABO learning progress", system: "chart.bar")
        }
        title("Study materials")
        if session.materials.isEmpty {
            infoTile("No materials available", "Ask your educator or upload through the web edition.", system: "book")
        }
        ForEach(session.materialSummaries) { material in
            Button {
                selectedMaterial = material
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "doc.text").foregroundColor(clay)
                    Text(material.title).font(.headline)
                    Spacer()
                    Image(systemName: "chevron.right").foregroundColor(.secondary)
                }
                .padding(16)
                .background(Color(UIColor.secondarySystemBackground),
                            in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .disabled(session.busy)
            .accessibilityHint("Opens the online reading view for this learning material")
        }
        title("Practice tests")
        if session.quizzes.isEmpty {
            infoTile("No tests available", "Your assessments will appear here when assigned.", system: "checkmark.circle")
        }
        ForEach(session.quizSummaries) { quiz in
            Button {
                selectedQuiz = quiz
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "checkmark.circle").foregroundColor(clay)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(quiz.title).font(.headline)
                        Text("\(quiz.questionCount) questions")
                            .font(.subheadline).foregroundColor(.secondary)
                        if let score = quiz.latestScore {
                            Text("Previous score: \(score.formatted())%")
                                .font(.footnote).foregroundColor(.secondary)
                        }
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundColor(.secondary)
                }
                .padding(16)
                .background(Color(UIColor.secondarySystemBackground),
                            in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .disabled(session.busy)
            .accessibilityHint("Opens a CABO practice assessment to complete and submit")
        }
        title("My learning support")
        if session.learnerHelp.isEmpty {
            infoTile("No requests yet", "You can ask your educator for additional help.", system: "person.2")
        }
        ForEach(session.learnerHelp, id: \.self) { ticket in
            infoTile(ticket, "My support request", system: "person.2")
        }
    }

    private func guardianExplanation(_ invite: GuardianInvitation) -> String {
        switch invite.status {
        case "pending": return "Waiting for your decision. No child records can be viewed."
        case "accepted": return "Invitation accepted; school verification required."
        case "verified": return invite.verifiedForRead
            ? "Guardian link verified and a school enrolment is active."
            : "Waiting for an active school enrolment."
        case "revoked": return "This guardian relationship has been revoked."
        default: return "Status: \(invite.status)"
        }
    }

    private func title(_ value: String) -> some View {
        Text(value).font(.title2.bold()).padding(.top, 4)
            .accessibilityAddTraits(.isHeader)
    }

    private func infoTile(_ name: String, _ detail: String, system: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: system).foregroundColor(clay).frame(width: 28)
            VStack(alignment: .leading, spacing: 6) {
                Text(name).font(.headline)
                Text(detail).font(.subheadline).foregroundColor(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}
