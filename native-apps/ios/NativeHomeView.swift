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
    @State private var showLearnerPassport = false
    @State private var showExamManagement = false
    @State private var showEducationCommand = false
    @State private var uploadSelection: NativeMaterialUploadSelection?
    @State private var showMaterialImporter = false
    @State private var materialImportError: String?
    @State private var reviewedGuardianEvidence: Set<Int> = []
    @Environment(\.horizontalSizeClass) private var sizeClass
    private let clay = Color(red: 196.0 / 255.0, green: 103.0 / 255.0, blue: 58.0 / 255.0)
    private let gold = Color(red: 201.0 / 255.0, green: 168.0 / 255.0, blue: 76.0 / 255.0)

    private var canOpenEducationCommand: Bool {
        ["superadmin", "owner", "admin", "national_director", "provincial_director", "district_director", "group_executive"]
            .contains(session.role ?? "")
    }

    private var isEducator: Bool {
        guard let role = session.role else { return false }
        return ["teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head", "administrator", "admin", "owner"]
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
                showExamManagement = false
                showLearnerPassport = false
                showEducationCommand = false
                session.clearEducationCommand()
                testPassword = ""
                reviewedGuardianEvidence = []
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
        .sheet(isPresented: $showLearnerPassport) {
            NativeLearnerPassportView(session: session)
        }
        .sheet(isPresented: $showExamManagement) {
            NativeExamManagementView(session: session)
        }
        .sheet(isPresented: $showEducationCommand) {
            NativeEducationCommandView(session: session)
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
                if canOpenEducationCommand {
                    Button {
                        showEducationCommand = true
                    } label: {
                        Label("Open Education Command", systemImage: "building.2.crop.circle")
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.bordered)
                }
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
        NativeNotificationPreferencesPanel(session: session)
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
        title("School-issued reports")
        if session.issuedReports.isEmpty {
            infoTile("No issued reports available", "A verified guardian can view a school's issued report after the school publishes it.", system: "doc.text.magnifyingglass")
        }
        ForEach(session.issuedReports) { report in
            NativeIssuedReportCard(session: session, report: report)
        }
    }

    @ViewBuilder
    private var educatorContent: some View {
        title("Teaching & learner support")
        if session.canManageExamAssignments {
            Button {
                Task {
                    await session.refreshExamManagement()
                    showExamManagement = true
                }
            } label: {
                Label("Manage written exam assignments", systemImage: "doc.text.magnifyingglass")
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .disabled(session.busy || session.examManagementBusy)
            Text("School managers can assign their own written exams to learner groups and review submitted marking.")
                .font(.footnote).foregroundColor(.secondary)
        }
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
                    SupportAccountabilityCard(summary: school.support)
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
        ForEach(session.guardianReviewWorkspaces) { workspace in
            VStack(alignment: .leading, spacing: 12) {
                Text("Family access review · school \(workspace.organizationId)")
                    .font(.headline).accessibilityAddTraits(.isHeader)
                Text("Confirm legal authority using your school's safeguarding process. CABO does not collect or upload identity documents here.")
                    .font(.footnote).foregroundColor(.secondary)
                if workspace.reviews.isEmpty {
                    Text("No family reviews awaiting action.")
                        .font(.subheadline).foregroundColor(.secondary)
                }
                ForEach(workspace.reviews) { review in
                    VStack(alignment: .leading, spacing: 9) {
                        Text("Guardian relationship \(review.id)").font(.subheadline.bold())
                        Text("Learner \(review.learnerId) · guardian \(review.guardianId)")
                            .font(.caption).foregroundColor(.secondary)
                        Text("\(review.status.replacingOccurrences(of: "_", with: " ")) · school review required")
                            .font(.caption).foregroundColor(.secondary)
                        Toggle("I independently reviewed legal authority",
                               isOn: Binding(
                                get: { reviewedGuardianEvidence.contains(review.id) },
                                set: { value in
                                    if value { reviewedGuardianEvidence.insert(review.id) }
                                    else { reviewedGuardianEvidence.remove(review.id) }
                                }))
                            .font(.footnote).disabled(session.busy)
                        if review.status == "accepted" {
                            Button("Verify guardian access") {
                                Task { await session.reviewGuardianRelationship(
                                    organizationId: workspace.organizationId, relationshipId: review.id,
                                    decision: "verified", evidenceReviewed: reviewedGuardianEvidence.contains(review.id)) }
                            }
                            .buttonStyle(.borderedProminent).disabled(session.busy || !reviewedGuardianEvidence.contains(review.id))
                        } else if review.status == "verified" {
                            Button("Revoke guardian access", role: .destructive) {
                                Task { await session.reviewGuardianRelationship(
                                    organizationId: workspace.organizationId, relationshipId: review.id,
                                    decision: "revoked", evidenceReviewed: reviewedGuardianEvidence.contains(review.id)) }
                            }
                            .buttonStyle(.bordered).disabled(session.busy || !reviewedGuardianEvidence.contains(review.id))
                        }
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(UIColor.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
        }
        ForEach(session.reportIssuanceWorkspaces) { workspace in
            NativeReportIssuanceSection(session: session, workspace: workspace)
        }
        NativeSchoolOperationsPanel(session: session)
        NativeAssessmentWorkspacePanel(session: session)
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
        Button { showLearnerPassport = true } label: {
            Label("Open my learner passport", systemImage: "person.text.rectangle")
                .frame(maxWidth: .infinity, minHeight: 48)
        }
        .buttonStyle(.bordered)
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
        title("School-issued reports")
        if session.issuedReports.isEmpty {
            infoTile("No issued reports yet", "A school-issued report appears here after the institution completes its review.", system: "doc.text.magnifyingglass")
        }
        ForEach(session.issuedReports) { report in
            NativeIssuedReportCard(session: session, report: report)
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
        title("Written exams")
        NavigationLink(destination: NativeWrittenExamView(session: session)) {
            Label("Create or take a written exam", systemImage: "doc.text.magnifyingglass")
                .frame(maxWidth: .infinity, minHeight: 48)
        }
        .buttonStyle(.borderedProminent)
        .disabled(session.busy)
        .accessibilityHint("Generate a written exam from your study material and submit answers for marking")
        if !session.writtenExams.isEmpty {
            ForEach(session.writtenExams) { exam in
                infoTile(exam.title, "\(exam.questions.count) questions · \(exam.difficulty.capitalized)", system: "doc.text")
            }
        }
        if session.canManageExamAssignments {
            Button {
                Task {
                    await session.refreshExamManagement()
                    showExamManagement = true
                }
            } label: {
                Label("Manage school exam assignments", systemImage: "building.2.crop.circle")
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.bordered)
            .disabled(session.busy || session.examManagementBusy)
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
        NativeSchoolOperationsPanel(session: session)
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

private struct NativeNotificationPreferencesPanel: View {
    @ObservedObject var session: NativeSession
    @State private var pending: NativePendingNotificationPreference?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Email preferences").font(.headline)
            Text("Optional school-related updates. You can turn these off at any time.")
                .font(.subheadline).foregroundColor(.secondary)
            if !session.notificationPreferences.enabled {
                Text("Preference controls are currently unavailable. You will not receive these optional updates.")
                    .font(.subheadline)
            } else if session.notificationPreferences.schools.isEmpty {
                Text("No school email preferences are available for this account.")
                    .font(.subheadline)
            } else {
                ForEach(session.notificationPreferences.schools) { school in
                    Text(school.name).font(.subheadline.bold()).padding(.top, 4)
                    ForEach(school.choices) { choice in
                        Toggle(isOn: Binding(
                            get: { choice.enabled },
                            set: { enabled in
                                if !enabled && choice.enabled {
                                    Task { await session.setNotificationPreference(
                                        organizationId: school.id, kind: choice.kind,
                                        enabled: false, acknowledged: false) }
                                } else if enabled && !choice.enabled && choice.canEnable &&
                                            session.notificationPreferences.optInAvailable {
                                    pending = NativePendingNotificationPreference(
                                        organizationId: school.id, kind: choice.kind)
                                }
                            }
                        )) {
                            Text(choice.title).font(.subheadline)
                        }
                        .disabled(session.busy || (!choice.enabled &&
                            (!choice.canEnable || !session.notificationPreferences.optInAvailable)))
                        if !choice.enabled && !choice.canEnable {
                            Text("This former school preference can only be turned off.")
                                .font(.caption).foregroundColor(.secondary)
                        }
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
        .alert(item: $pending) { request in
            Alert(
                title: Text("Confirm optional email updates"),
                message: Text("I agree to receive this school-related email. It is optional and can be turned off at any time."),
                primaryButton: .default(Text("I agree")) {
                    Task { await session.setNotificationPreference(
                        organizationId: request.organizationId, kind: request.kind,
                        enabled: true, acknowledged: true) }
                },
                secondaryButton: .cancel()
            )
        }
    }
}

private struct NativeSchoolOperationsPanel: View {
    @ObservedObject var session: NativeSession
    @State private var subject = ""
    @State private var message = ""
    @State private var audience = "all"
    @State private var learnerId = ""
    @State private var attendanceDay = String(ISO8601DateFormatter().string(from: Date()).prefix(10))
    @State private var attendanceStatus = "present"
    @State private var attendanceNote = ""
    @State private var replacementTeacherId = ""
    @State private var substitutionReason = ""

    var body: some View {
        if !session.schoolOperations.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                Label("School operations", systemImage: "building.2").font(.title3.bold())
                ForEach(session.schoolOperations) { workspace in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(workspace.organizationName).font(.headline)
                        Text("Membership · \(workspace.membershipRole)").font(.footnote).foregroundColor(.secondary)
                        if let notice = workspace.notice { Text(notice).font(.footnote).foregroundColor(.secondary) }
                        Text("School notices").font(.subheadline.bold())
                        if workspace.notices.isEmpty { Text("No notices available.").font(.footnote).foregroundColor(.secondary) }
                        ForEach(workspace.notices) { item in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.subject).font(.subheadline.bold())
                                Text(item.message).font(.subheadline)
                                Text("\(item.audience.capitalized) · \(item.createdAt)").font(.caption).foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(10)
                            .background(Color(UIColor.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                        }
                        if workspace.membershipRole == "learner" {
                            Text("My attendance").font(.subheadline.bold()).padding(.top, 3)
                            if workspace.attendance.isEmpty { Text("No attendance recorded yet.").font(.footnote).foregroundColor(.secondary) }
                            ForEach(workspace.attendance) { row in
                                HStack { Text(row.day); Spacer(); Text(row.status.capitalized).foregroundColor(.secondary) }
                                    .font(.subheadline)
                            }
                        }
                        if let summary = workspace.attendanceSummary {
                            Text("Attendance overview · \(summary.year)").font(.subheadline.bold())
                            Text("\(summary.records) recorded days").font(.subheadline)
                            ForEach(summary.counts.keys.sorted(), id: \.self) { key in
                                Text("\(key.capitalized): \(summary.counts[key] ?? 0)").font(.footnote).foregroundColor(.secondary)
                            }
                        }
                        Text("Published timetable").font(.subheadline.bold()).padding(.top, 3)
                        if workspace.timetable.isEmpty { Text("No published timetable available.").font(.footnote).foregroundColor(.secondary) }
                        ForEach(workspace.timetable) { slot in
                            VStack(alignment: .leading, spacing: 3) {
                                Text("\(weekday(slot.day)) · \(slot.startsAt)–\(slot.endsAt)").font(.caption).foregroundColor(.secondary)
                                Text("\(slot.subject) · \(slot.grade) \(slot.group)").font(.subheadline.bold())
                                Text("\(slot.room) · \(slot.status.capitalized)").font(.footnote).foregroundColor(.secondary)
                            }
                        }
                        if workspace.canManage {
                            Divider()
                            Text("Publish a school notice").font(.subheadline.bold())
                            TextField("Notice title", text: $subject).textFieldStyle(.roundedBorder)
                            TextField("Message for the school community", text: $message).textFieldStyle(.roundedBorder)
                            Picker("Audience", selection: $audience) {
                                Text("Everyone").tag("all"); Text("Learners").tag("learners"); Text("Staff").tag("staff")
                            }.pickerStyle(.segmented)
                            Button("Publish notice") {
                                Task { await session.publishSchoolNotice(organizationId: workspace.organizationId, subject: subject, message: message, audience: audience) }
                            }.buttonStyle(.borderedProminent).disabled(session.busy || subject.count < 3 || message.count < 10)

                            Text("Record learner attendance").font(.subheadline.bold()).padding(.top, 4)
                            TextField("Learner account ID", text: $learnerId).textInputAutocapitalization(.never).textFieldStyle(.roundedBorder)
                            TextField("Date (YYYY-MM-DD)", text: $attendanceDay).textInputAutocapitalization(.never).textFieldStyle(.roundedBorder)
                            Picker("Status", selection: $attendanceStatus) {
                                Text("Present").tag("present"); Text("Absent").tag("absent")
                                Text("Late").tag("late"); Text("Excused").tag("excused")
                            }.pickerStyle(.segmented)
                            TextField("Note (optional)", text: $attendanceNote).textFieldStyle(.roundedBorder)
                            Button("Save attendance") {
                                Task { await session.recordSchoolAttendance(organizationId: workspace.organizationId, learnerId: learnerId, day: attendanceDay, attendanceStatus: attendanceStatus, note: attendanceNote) }
                            }.buttonStyle(.bordered).disabled(session.busy || learnerId.isEmpty)

                            Text("Assign a timetable substitute").font(.subheadline.bold()).padding(.top, 4)
                            TextField("Replacement teacher account ID", text: $replacementTeacherId).textInputAutocapitalization(.never).textFieldStyle(.roundedBorder)
                            TextField("Reason for substitution", text: $substitutionReason).textFieldStyle(.roundedBorder)
                            ForEach(workspace.timetable) { slot in
                                Button("Substitute for \(slot.subject) · slot \(slot.id)") {
                                    Task { await session.substituteSchoolTeacher(organizationId: workspace.organizationId, slotId: slot.id, replacementTeacherId: replacementTeacherId, reason: substitutionReason) }
                                }.buttonStyle(.bordered).disabled(session.busy || replacementTeacherId.isEmpty || substitutionReason.count < 5)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).padding(16)
                    .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
                }
            }.padding(.vertical, 8)
        }
    }

    private func weekday(_ day: Int) -> String {
        let symbols = Calendar.current.weekdaySymbols
        return (1...7).contains(day) ? symbols[(day - 1) % symbols.count] : "Day \(day)"
    }
}

private struct NativeAssessmentWorkspacePanel: View {
    @ObservedObject var session: NativeSession
    @State private var grade = ""
    @State private var subject = ""
    @State private var curriculum = "National Curriculum"
    @State private var stem = ""
    @State private var answerGuide = ""
    @State private var rubric = ""
    @State private var sourceAttribution = ""
    @State private var license = "original"
    @State private var reviewNote = ""
    @State private var paperTitle = ""
    @State private var paperQuestionIds = ""

    var body: some View {
        if !session.assessmentWorkspaces.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                Label("Assessment workspace", systemImage: "checklist")
                    .font(.title3.bold()).accessibilityAddTraits(.isHeader)
                ForEach(session.assessmentWorkspaces) { workspace in
                    VStack(alignment: .leading, spacing: 12) {
                        Text(workspace.organizationName).font(.headline)
                        Text("School membership · \(workspace.membershipRole)")
                            .font(.footnote).foregroundColor(.secondary)
                        if let notice = workspace.notice {
                            Text(notice).font(.footnote).foregroundColor(.secondary)
                        }
                        Text("Question bank").font(.subheadline.bold())
                        if workspace.questions.isEmpty {
                            Text("No questions are available in this school bank.").font(.footnote).foregroundColor(.secondary)
                        }
                        ForEach(workspace.questions) { question in
                            VStack(alignment: .leading, spacing: 7) {
                                Text("\(question.subject) · \(question.grade) · \(question.curriculum)")
                                    .font(.caption).foregroundColor(.secondary)
                                Text(question.stem).font(.subheadline.bold())
                                Text("Answer guide: \(question.answerGuide)").font(.footnote)
                                if !question.rubric.isEmpty { Text("Rubric: \(question.rubric)").font(.footnote) }
                                Text("Source: \(question.sourceAttribution) · \(question.license)")
                                    .font(.caption).foregroundColor(.secondary)
                                Text("Status · \(question.status.capitalized)")
                                    .font(.caption.bold()).foregroundColor(.secondary)
                                questionActions(question, workspace: workspace)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(11)
                            .background(Color(UIColor.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                        }
                        if ["owner", "admin", "teacher"].contains(workspace.membershipRole) {
                            Divider()
                            Text("Add an attributed question").font(.subheadline.bold())
                            TextField("Grade", text: $grade).textFieldStyle(.roundedBorder)
                            TextField("Subject", text: $subject).textFieldStyle(.roundedBorder)
                            TextField("Curriculum", text: $curriculum).textFieldStyle(.roundedBorder)
                            TextField("Question stem", text: $stem).textFieldStyle(.roundedBorder)
                            TextField("Answer guide", text: $answerGuide).textFieldStyle(.roundedBorder)
                            TextField("Marking rubric (optional)", text: $rubric).textFieldStyle(.roundedBorder)
                            TextField("Source attribution", text: $sourceAttribution).textFieldStyle(.roundedBorder)
                            Picker("Content license", selection: $license) {
                                Text("Original").tag("original")
                                Text("CC BY").tag("CC-BY")
                                Text("CC BY SA").tag("CC-BY-SA")
                                Text("Public domain").tag("public-domain")
                                Text("Institution licensed").tag("institution-licensed")
                            }
                            Button("Save question draft") {
                                Task { await session.createAssessmentQuestion(organizationId: workspace.organizationId,
                                    grade: grade, subject: subject, curriculum: curriculum, stem: stem,
                                    answerGuide: answerGuide, rubric: rubric, sourceAttribution: sourceAttribution, license: license) }
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(session.busy || grade.isEmpty || subject.count < 2 || curriculum.count < 2 ||
                                      stem.count < 10 || answerGuide.count < 3 || sourceAttribution.count < 5)

                            Text("Create an assessment paper").font(.subheadline.bold()).padding(.top, 3)
                            TextField("Paper title", text: $paperTitle).textFieldStyle(.roundedBorder)
                            TextField("Published question IDs, comma separated", text: $paperQuestionIds)
                                .keyboardType(.numbersAndPunctuation).textFieldStyle(.roundedBorder)
                            Button("Save paper draft") {
                                let ids = paperQuestionIds.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
                                Task { await session.createAssessmentPaper(organizationId: workspace.organizationId,
                                    academicYear: Calendar.current.component(.year, from: Date()), grade: grade,
                                    subject: subject, curriculum: curriculum, title: paperTitle, questionIds: ids) }
                            }
                            .buttonStyle(.bordered)
                            .disabled(session.busy || paperTitle.count < 5 || paperQuestionIds.isEmpty || grade.isEmpty || subject.count < 2)
                        }

                        Text("Assessment papers").font(.subheadline.bold()).padding(.top, 3)
                        if workspace.papers.isEmpty {
                            Text("No paper drafts or published assessments yet.").font(.footnote).foregroundColor(.secondary)
                        }
                        ForEach(workspace.papers) { paper in
                            VStack(alignment: .leading, spacing: 5) {
                                Text(paper.title).font(.subheadline.bold())
                                Text("\(paper.grade) · \(paper.subject) · \(paper.academicYear) · \(paper.questionCount) questions")
                                    .font(.caption).foregroundColor(.secondary)
                                Text("Status · \(paper.status.capitalized)").font(.caption.bold())
                                paperActions(paper, workspace: workspace)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(10)
                            .background(Color(UIColor.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).padding(16)
                    .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
                }
            }
            .padding(.vertical, 8)
        }
    }

    @ViewBuilder
    private func questionActions(_ question: NativeAssessmentQuestion, workspace: NativeAssessmentWorkspace) -> some View {
        if question.status == "draft" {
            Button("Submit for independent review") {
                Task { await session.decideAssessmentQuestion(organizationId: workspace.organizationId,
                    questionId: question.id, action: "submit", note: "") }
            }.buttonStyle(.bordered).disabled(session.busy)
        }
        if question.status == "submitted" && ["owner", "admin"].contains(workspace.membershipRole) {
            TextField("Review note (required to reject)", text: $reviewNote).textFieldStyle(.roundedBorder)
            HStack {
                Button("Approve question") {
                    Task { await session.decideAssessmentQuestion(organizationId: workspace.organizationId,
                        questionId: question.id, action: "approve", note: reviewNote) }
                }.buttonStyle(.borderedProminent).disabled(session.busy)
                Button("Reject") {
                    Task { await session.decideAssessmentQuestion(organizationId: workspace.organizationId,
                        questionId: question.id, action: "reject", note: reviewNote) }
                }.buttonStyle(.bordered).disabled(session.busy || reviewNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        if question.status == "approved" && ["owner", "admin"].contains(workspace.membershipRole) {
            Button("Publish question") {
                Task { await session.decideAssessmentQuestion(organizationId: workspace.organizationId,
                    questionId: question.id, action: "publish", note: "") }
            }.buttonStyle(.borderedProminent).disabled(session.busy)
        }
        if ["published", "rejected"].contains(question.status) && ["owner", "admin"].contains(workspace.membershipRole) {
            TextField("Archive reason", text: $reviewNote).textFieldStyle(.roundedBorder)
            Button("Archive question") {
                Task { await session.decideAssessmentQuestion(organizationId: workspace.organizationId,
                    questionId: question.id, action: "archive", note: reviewNote) }
            }.buttonStyle(.bordered).disabled(session.busy || reviewNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    @ViewBuilder
    private func paperActions(_ paper: NativeAssessmentPaper, workspace: NativeAssessmentWorkspace) -> some View {
        if paper.status == "draft" {
            Button("Submit paper for review") {
                Task { await session.decideAssessmentPaper(organizationId: workspace.organizationId,
                    paperId: paper.id, action: "submit", note: "") }
            }.buttonStyle(.bordered).disabled(session.busy)
        }
        if paper.status == "submitted" && ["owner", "admin"].contains(workspace.membershipRole) {
            TextField("Paper review note (required to reject)", text: $reviewNote).textFieldStyle(.roundedBorder)
            HStack {
                Button("Approve paper") {
                    Task { await session.decideAssessmentPaper(organizationId: workspace.organizationId,
                        paperId: paper.id, action: "approve", note: reviewNote) }
                }.buttonStyle(.borderedProminent).disabled(session.busy)
                Button("Reject paper") {
                    Task { await session.decideAssessmentPaper(organizationId: workspace.organizationId,
                        paperId: paper.id, action: "reject", note: reviewNote) }
                }.buttonStyle(.bordered).disabled(session.busy || reviewNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        if paper.status == "approved" && ["owner", "admin"].contains(workspace.membershipRole) {
            Button("Publish paper") {
                Task { await session.decideAssessmentPaper(organizationId: workspace.organizationId,
                    paperId: paper.id, action: "publish", note: "") }
            }.buttonStyle(.borderedProminent).disabled(session.busy)
        }
    }
}

private struct NativeReportIssuanceSection: View {
    @ObservedObject var session: NativeSession
    let workspace: NativeReportIssuanceWorkspace
    @State private var learnerId = ""
    @State private var academicYear = Calendar.current.component(.year, from: Date())

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("School report workflow · school \(workspace.organizationId)")
                .font(.headline).accessibilityAddTraits(.isHeader)
            Text("Reports are snapshots of published assessments. Approval must come from a different authorised school administrator. The server checks content integrity before issue.")
                .font(.footnote).foregroundColor(.secondary)
            VStack(alignment: .leading, spacing: 10) {
                Text("Prepare a report").font(.subheadline.bold())
                TextField("Enrolled learner account ID", text: $learnerId)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder).disabled(session.busy)
                TextField("Academic year", value: $academicYear, format: .number)
                    .keyboardType(.numberPad).textFieldStyle(.roundedBorder).disabled(session.busy)
                Button("Submit report for review") {
                    Task { await session.submitSchoolReport(organizationId: workspace.organizationId,
                        learnerId: learnerId, academicYear: academicYear) }
                }
                .buttonStyle(.borderedProminent)
                .disabled(session.busy || learnerId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !(2000...2200).contains(academicYear))
            }
            .padding(15)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 12))

            if workspace.records.isEmpty {
                Text("No report versions. Submitted school reports will appear here for independent review.")
                    .font(.subheadline).foregroundColor(.secondary)
            }
            ForEach(workspace.records) { record in
                NativeReportIssuanceRow(session: session, organizationId: workspace.organizationId, record: record)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct NativeReportIssuanceRow: View {
    @ObservedObject var session: NativeSession
    let organizationId: Int
    let record: NativeReportIssuanceRecord
    @State private var reason = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Learner \(record.learnerId)").font(.subheadline.bold())
            Text("\(record.academicYear) · version \(record.version) · \(record.status.replacingOccurrences(of: "_", with: " "))")
                .font(.caption).foregroundColor(.secondary)
            Text("SHA-256 \(String(record.contentHash.prefix(24)))…")
                .font(.caption.monospaced()).foregroundColor(.secondary).textSelection(.enabled)
            if record.reviewedBy != nil {
                Label("Independent reviewer recorded", systemImage: "person.2")
                    .font(.caption).foregroundColor(.secondary)
            }
            if ["submitted", "issued"].contains(record.status) {
                TextField("Reason for rejection or revocation", text: $reason)
                    .textFieldStyle(.roundedBorder).disabled(session.busy)
            }
            HStack {
                switch record.status {
                case "submitted":
                    Button("Reject", role: .destructive) { decide("reject") }
                        .buttonStyle(.bordered).disabled(session.busy || reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    Button("Approve") { decide("approve") }
                        .buttonStyle(.borderedProminent).disabled(session.busy)
                case "approved":
                    Button("Issue report") { decide("issue") }
                        .buttonStyle(.borderedProminent).disabled(session.busy)
                case "issued":
                    Button("Revoke", role: .destructive) { decide("revoke") }
                        .buttonStyle(.bordered).disabled(session.busy || reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                default:
                    EmptyView()
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private func decide(_ action: String) {
        Task {
            await session.decideSchoolReport(organizationId: organizationId, reportId: record.id,
                                             action: action, reason: reason)
        }
    }
}

private struct NativeIssuedReportCard: View {
    @ObservedObject var session: NativeSession
    let report: NativeIssuedSchoolReport

    private var integrityMessage: String? {
        guard let check = session.issuedReportIntegrity[report.key] else { return nil }
        if check.hashValid == nil { return "Legacy digest · stored content cannot be verified." }
        if check.hashValid == false { return "Warning · report content hash mismatch." }
        if check.signatureValid { return "Signature verified. Issuer accreditation is not asserted." }
        if check.cryptographicallySigned { return "Signature present but not trusted or not valid." }
        return "Content integrity checked. No cryptographic signature configured."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let learnerName = report.learnerName?.trimmingCharacters(in: .whitespacesAndNewlines),
               !learnerName.isEmpty {
                Text("\(learnerName)'s report")
                    .font(.headline)
            }
            Text("Grade \(report.snapshot.grade) · \(report.academicYear)")
                .font(.title3.bold()).accessibilityAddTraits(.isHeader)
            if let average = report.snapshot.average {
                Text("Published average · \(average.formatted())%")
                    .font(.headline)
            }
            ForEach(report.snapshot.subjects) { subject in
                HStack {
                    Text(subject.name)
                    Spacer(minLength: 8)
                    Text("\(subject.percentage.formatted())%")
                        .fontWeight(.semibold).monospacedDigit()
                }
                .font(.subheadline)
            }
            if let attendanceRate = report.snapshot.attendance.rate {
                Text("Attendance · \(attendanceRate)% · \(report.snapshot.attendance.presentDays) of \(report.snapshot.attendance.recordedDays) days")
                    .font(.subheadline)
            }
            Text("School-issued pilot record · not a digitally signed or accredited certificate.")
                .font(.footnote).foregroundColor(.secondary)
            Text("SHA-256 \(report.contentHash)")
                .font(.caption.monospaced()).foregroundColor(.secondary).textSelection(.enabled)
            Button(session.issuedReportIntegrity[report.key] == nil ? "Check report integrity" : "Check integrity again") {
                Task { await session.verifyIssuedReport(report) }
            }
            .buttonStyle(.bordered).disabled(session.busy)
            if let integrityMessage {
                Text(integrityMessage)
                    .font(.footnote)
                    .foregroundColor(session.issuedReportIntegrity[report.key]?.hashValid == false ? .red : .secondary)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}



private struct SupportAccountabilityCard: View {
    let summary: [String]

    private var metrics: [(String, Int)] {
        let values = Dictionary(summary.compactMap { item -> (String, Int)? in
            guard let separator = item.firstIndex(of: ":"),
                  let count = Int(item[item.index(after: separator)...].trimmingCharacters(in: .whitespacesAndNewlines))
            else { return nil }
            let key = item[..<separator].lowercased().filter { $0.isLetter || $0.isNumber }
            return (key, count)
        }, uniquingKeysWith: { first, _ in first })

        func value(_ keys: String...) -> Int? {
            keys.compactMap { values[$0] }.first
        }

        return [
            value("total", "openrequests").map { ("Open requests", $0) },
            value("unassigned").map { ("Unassigned", $0) },
            value("overduecheckpoints", "followupsdue").map { ("Follow-ups due", $0) },
            value("awaitinglearner").map { ("Awaiting learner", $0) },
            value("needsmorehelp").map { ("Needs more help", $0) },
            value("measuredoutcomes").map { ("Measured outcomes", $0) }
        ].compactMap { $0 }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Support accountability").font(.headline)
            Text("Counts include only requests your account can view. They are not a staff ranking.")
                .font(.footnote).foregroundColor(.secondary)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(Array(metrics.enumerated()), id: \.offset) { element in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(String(element.element.1))
                            .font(.title2.weight(.semibold))
                            .accessibilityLabel("\(element.element.1) \(element.element.0)")
                        Text(element.element.0).font(.caption).foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
                    .padding(12)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}
