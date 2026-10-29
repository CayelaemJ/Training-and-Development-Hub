import SwiftUI
import UniformTypeIdentifiers

// Fully native role-based SwiftUI. Uses NavigationView for iOS 15 support,
// a sidebar + content pane on iPad and a single touch-first view on iPhone.
struct NativeHomeView: View {
    @StateObject private var session = NativeSession()
    @State private var testUsername = "cabo_test"
    @State private var testPassword = ""
    @State private var selectedQuiz: NativeQuizSummary?
    @State private var selectedMaterial: NativeMaterialSummary?
    @State private var selectedStaffTicket: NativeStaffSupportTicket?
    @State private var showSupportRequests = false
    @State private var showLearnerJourney = false
    @State private var uploadSelection: NativeMaterialUploadSelection?
    @State private var showMaterialImporter = false
    @State private var materialImportError: String?
    @Environment(\.horizontalSizeClass) private var sizeClass
    private let clay = Color(red: 196.0 / 255.0, green: 103.0 / 255.0, blue: 58.0 / 255.0)
    private let gold = Color(red: 201.0 / 255.0, green: 168.0 / 255.0, blue: 76.0 / 255.0)

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
        .onChange(of: session.role) { current in
            // Revoke visible private study screens as soon as auth is lost.
            if current == nil {
                selectedQuiz = nil
                selectedMaterial = nil
                selectedStaffTicket = nil
                testPassword = ""
            }
        }
        .sheet(item: $selectedQuiz) { quiz in
            NativeQuizView(session: session, item: quiz)
        }
        .sheet(item: $selectedMaterial) { material in
            NativeMaterialView(session: session, item: material)
        }
        .sheet(item: $selectedStaffTicket) { ticket in
            NativeStaffSupportView(session: session, ticket: ticket)
        }
        .sheet(item: $uploadSelection) { selection in
            NativeMaterialUploadView(session: session, selection: selection)
        }
        .sheet(isPresented: $showSupportRequests) {
            NativeSupportRequestView(session: session)
        }
        .sheet(isPresented: $showLearnerJourney) {
            NativeLearnerJourneyView(session: session)
        }
        .fileImporter(isPresented: $showMaterialImporter, allowedContentTypes: materialUploadTypes) { result in
            switch result {
            case .success(let url):
                let baseName = url.deletingPathExtension().lastPathComponent
                    .replacingOccurrences(of: "[_-]+", with: " ", options: .regularExpression)
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                uploadSelection = NativeMaterialUploadSelection(
                    url: url,
                    suggestedTitle: String((baseName.isEmpty ? "Study material" : baseName).prefix(200))
                )
            case .failure:
                materialImportError = "CABO could not open that file. Choose a supported study document and try again."
            }
        }
        .alert("File not selected", isPresented: Binding(
            get: { materialImportError != nil },
            set: { if !$0 { materialImportError = nil } }
        )) {
            Button("OK", role: .cancel) { materialImportError = nil }
        } message: {
            Text(materialImportError ?? "")
        }
    }

    private var materialUploadTypes: [UTType] {
        ["pdf", "txt", "md", "csv", "docx", "pptx", "xlsx", "png", "jpg", "jpeg", "webp"]
            .compactMap { UTType(filenameExtension: $0) }
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
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("CABO")
                        .font(.system(size: 29, weight: .bold, design: .serif))
                        .tracking(2).foregroundColor(clay)
                    Text("SOLUTIONS")
                        .font(.system(size: 8, weight: .medium, design: .monospaced))
                        .tracking(2.2).foregroundColor(gold)
                }
                Rectangle().fill(Color(UIColor.separator)).frame(width: 1, height: 34)
                Text("Training &\nDevelopment Hub")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color(UIColor.label))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("CABO Solutions, Training and Development Hub")
            Text(session.status).font(.subheadline).foregroundColor(.secondary)
            if session.busy { ProgressView("Connecting…") }
            if session.role == nil {
                Button("Sign in securely") { session.signIn() }
                    .buttonStyle(.borderedProminent).disabled(session.busy)
                    .controlSize(.large)
                if session.testLoginAvailable {
                    Divider()
                    Text("Isolated test account").font(.headline)
                    TextField("Test username", text: $testUsername)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)
                    SecureField("Test password", text: $testPassword)
                        .textContentType(.password)
                        .textFieldStyle(.roundedBorder)
                    Button("Sign in to test environment") {
                        let secret = testPassword
                        testPassword = ""
                        Task { await session.signInTest(username: testUsername, password: secret) }
                    }
                    .buttonStyle(.bordered)
                    .disabled(session.busy || testUsername.isEmpty || testPassword.isEmpty)
                    Text("Only for an isolated dummy-data CABO pilot. Real school accounts use secure browser sign-in.")
                        .font(.footnote).foregroundColor(.secondary)
                }
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
        } else if session.role == "superadmin" {
            adminContent
        } else if session.role == "parent" {
            parentContent
        } else if isEducator {
            educatorContent
        } else {
            learnerContent
        }
    }

    @ViewBuilder
    private var adminContent: some View {
        title("Platform governance")
        Text("Read-only CABO institution registry. Private learner records remain access-controlled.")
            .font(.subheadline).foregroundColor(.secondary)
        ForEach(session.summary, id: \.self) { metric in
            infoTile(metric, "Current platform registry total", system: "chart.bar")
        }
        title("Organisations")
        if session.adminOrganizations.isEmpty {
            infoTile("No organisations", "There are no registered organisations to display.",
                     system: "building.2")
        }
        ForEach(session.adminOrganizations, id: \.self) { organisation in
            infoTile(organisation, "Institution registry", system: "building.2")
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
        title("School-verified progress")
        if !session.guardianReportNotice.isEmpty {
            Text(session.guardianReportNotice)
                .font(.footnote).foregroundColor(.secondary)
        }
        if session.guardianReports.isEmpty {
            infoTile("No verified reports", "School verification and active enrolment are required before marks or attendance can be viewed.", system: "lock.shield")
        }
        ForEach(session.guardianReports) { report in
            VStack(alignment: .leading, spacing: 12) {
                Text(report.learnerName).font(.title3.bold())
                    .accessibilityAddTraits(.isHeader)
                Text("\(report.grade) · \(report.year) · Draft progress")
                    .font(.subheadline).foregroundColor(.secondary)
                if let average = report.average {
                    Label("Average \(average.formatted())%", systemImage: "chart.bar")
                        .font(.headline)
                }
                if let rate = report.attendance.rate {
                    Label("Attendance \(rate)% (\(report.attendance.presentDays) of \(report.attendance.recordedDays) recorded days)", systemImage: "calendar")
                } else {
                    Text("Attendance not recorded.").font(.subheadline)
                }
                Text("Subjects").font(.headline)
                if report.subjects.isEmpty {
                    Text("No published assessment marks yet.")
                        .font(.subheadline).foregroundColor(.secondary)
                }
                ForEach(report.subjects) { subject in
                    HStack {
                        Text(subject.name)
                        Spacer(minLength: 8)
                        Text("\(subject.percentage.formatted())%").monospacedDigit()
                    }
                    .font(.subheadline)
                }
                Text("Not an officially issued report card.")
                    .font(.footnote).foregroundColor(.secondary)
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
        }
    }

    @ViewBuilder
    private var educatorContent: some View {
        title("Teaching & learner support")
        if session.role == "teacher" {
            Button { showMaterialImporter = true } label: {
                Label("Share study material", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .disabled(session.busy)
        }
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
                if !school.ticketSummaries.isEmpty {
                    Text("Learner help requests").font(.headline).padding(.top, 8)
                    ForEach(school.ticketSummaries) { ticket in
                        Button { selectedStaffTicket = ticket } label: {
                            HStack(spacing: 10) {
                                Label(ticket.concept, systemImage: "person.crop.circle.badge.questionmark")
                                Spacer(minLength: 8)
                                Text(ticket.status.replacingOccurrences(of: "_", with: " "))
                                    .font(.caption).foregroundColor(.secondary)
                                Image(systemName: "chevron.right").font(.caption).foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
        }
        Text("Actions are limited by your server-assigned school and course permissions.")
            .font(.footnote).foregroundColor(.secondary)
    }

    @ViewBuilder
    private var learnerContent: some View {
        title("My learning journey")
        Button { showLearnerJourney = true } label: {
            Label("Manage my private learning journey", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                .frame(maxWidth: .infinity, minHeight: 48)
        }
        .buttonStyle(.borderedProminent)
        .disabled(session.busy)
        ForEach(session.summary + session.journey, id: \.self) { item in
            infoTile(item, "Current CABO learning progress", system: "chart.bar")
        }
        title("My academic report")
        if !session.learnerReportNotice.isEmpty {
            Text(session.learnerReportNotice)
                .font(.footnote).foregroundColor(.secondary)
        }
        if session.learnerReports.isEmpty {
            infoTile("No report preview yet", "A verified school enrolment and published assessments are needed.", system: "chart.bar.doc.horizontal")
        }
        ForEach(session.learnerReports) { report in
            VStack(alignment: .leading, spacing: 12) {
                Text("\(report.grade) · \(report.year)")
                    .font(.title3.bold()).accessibilityAddTraits(.isHeader)
                if let average = report.average {
                    Text("Published assessment average: \(average.formatted())%")
                        .font(.headline)
                }
                if let rate = report.attendance.rate {
                    Text("Attendance: \(rate)% (\(report.attendance.presentDays) of \(report.attendance.recordedDays) recorded days)")
                } else {
                    Text("Attendance has not been recorded.")
                }
                if report.subjects.isEmpty {
                    Text("No published subject marks yet.").foregroundColor(.secondary)
                }
                ForEach(report.subjects) { subject in
                    HStack {
                        Text(subject.name)
                        Spacer(minLength: 8)
                        Text("\(subject.percentage.formatted())%")
                            .monospacedDigit()
                    }
                    .font(.subheadline)
                }
                Text("Draft learner preview. This is not an officially issued report card.")
                    .font(.footnote).foregroundColor(.secondary)
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
        }
        title("Study materials")
        Button { showMaterialImporter = true } label: {
            Label("Add material from this device", systemImage: "square.and.arrow.up")
                .frame(maxWidth: .infinity, minHeight: 48)
        }
        .buttonStyle(.borderedProminent)
        .disabled(session.busy)
        if session.materials.isEmpty {
            infoTile("No materials available", "Ask your educator to share study materials with you.", system: "book")
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
        Button { showSupportRequests = true } label: {
            Label("Ask for help or manage drafts", systemImage: "questionmark.bubble")
                .frame(maxWidth: .infinity, minHeight: 48)
        }
        .buttonStyle(.borderedProminent)
        .disabled(session.busy)
        if session.learnerHelp.isEmpty {
            infoTile("No requests yet", "You can ask your educator for additional help.", system: "person.2")
        }
        ForEach(session.learnerHelp) { ticket in
            Button { selectedStaffTicket = ticket } label: {
                HStack(spacing: 12) {
                    Image(systemName: "person.2").foregroundColor(clay)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(ticket.concept).font(.headline).foregroundColor(.primary)
                        Text("\(ticket.status.replacingOccurrences(of: "_", with: " ")) · Request #\(ticket.id)")
                            .font(.subheadline).foregroundColor(.secondary)
                        if ticket.feedback != nil { Text("Your response has been recorded.").font(.footnote).foregroundColor(.secondary) }
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundColor(.secondary)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .disabled(session.busy)
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
        Text(value).font(.system(.title2, design: .serif).bold()).padding(.top, 4)
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

