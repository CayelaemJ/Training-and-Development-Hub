import Foundation
import SwiftUI
import AuthenticationServices
import CryptoKit
import Security
import UIKit

// Native iOS sign-in uses the system-owned authentication browser session.
// No WKWebView, password handling, or web-cookie copying.
struct GuardianInvitation: Identifiable {
    let id: Int
    let status: String
    let learnerName: String?
    let verifiedForRead: Bool
}
struct StaffSchool: Identifiable {
    let id: Int
    let subjects: [String]
    let support: [String]
    let ticketSummaries: [NativeStaffSupportTicket]
    let notice: String?
}
struct NativeStaffSupportTicket: Codable, Identifiable {
    let id: Int
    let organizationId: Int
    let courseId: Int
    let concept: String
    let question: String
    let attempted: String
    let status: String
    let version: Int
}
struct NativeSupportCourse: Codable, Identifiable, Hashable {
    let organizationId: Int
    let courseId: Int
    let name: String
    var id: String { "\(organizationId):\(courseId)" }
}
struct NativeSupportDraft: Codable, Identifiable {
    let requestKey: String
    let organizationId: Int
    let courseId: Int
    let courseName: String
    let concept: String
    let question: String
    let attempted: String
    var id: String { requestKey }
}
private struct NativeSupportDraftStore: Codable {
    let ownerId: String
    let drafts: [NativeSupportDraft]
}
private struct NativeSupportCourseStore: Codable {
    let ownerId: String
    let courses: [NativeSupportCourse]
}

@MainActor
final class NativeSession: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published var status = "Sign in to load your CABO learning records."
    @Published var busy = false
    @Published var role: String?
    @Published var summary: [String] = []
    @Published var workspaces: [String] = []
    @Published var materials: [String] = []
    @Published var materialSummaries: [NativeMaterialSummary] = []
    @Published var quizzes: [String] = []
    @Published var quizSummaries: [NativeQuizSummary] = []
    @Published var guardians: [GuardianInvitation] = []
    @Published var guardianGuidance = ""
    @Published var guardianReports: [NativeGuardianReport] = []
    @Published var guardianReportNotice = ""
    @Published var staffSchools: [StaffSchool] = []
    @Published var adminOrganizations: [String] = []
    @Published var journey: [String] = []
    @Published var learnerHelp: [String] = []
    @Published var learnerReports: [NativeLearnerReport] = []
    @Published var learnerReportNotice = ""
    @Published var supportCourses: [NativeSupportCourse] = []
    @Published var supportDrafts: [NativeSupportDraft] = []

    // Test-login is a build-time opt-in, never enabled by a server response.
    var testLoginAvailable: Bool {
        Bundle.main.object(forInfoDictionaryKey: "CABO_ENABLE_TEST_LOGIN") as? Bool == true &&
            origin.host != "cabo-learning-hub-pilot.onrender.com"
    }
    private let origin: URL = {
        let source = Bundle.main.object(forInfoDictionaryKey: "CABO_API_ORIGIN") as? String ?? ""
        guard let url = URL(string: source),
              url.scheme == "https", url.host != nil,
              url.user == nil, url.password == nil,
              url.query == nil, url.fragment == nil else {
            return URL(string: "https://cabo-learning-hub-pilot.onrender.com")!
        }
        return url
    }()
    private let clientID = "cabo-ios"
    private let redirectScheme = "cabo-learninghub-ios"
    private var browserSession: ASWebAuthenticationSession?
    private var pendingVerifier: String?
    private var pendingState: String?

    private func randomBase64URL() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let result = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        precondition(result == errSecSuccess)
        return Data(bytes).base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    private func base64URL(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }.first(where: { $0.isKeyWindow }) ?? UIWindow()
    }

    func signIn() {
        guard !busy else { return }
        let verifier = randomBase64URL()
        let state = randomBase64URL()
        pendingVerifier = verifier
        pendingState = state
        let challenge = base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        var components = URLComponents(url: origin.appendingPathComponent("api/native/authorize"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state)
        ]
        guard let url = components.url else {
            status = "Cannot create a secure sign-in request."
            return
        }
        busy = true
        status = "Opening CABO secure sign-in…"
        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: redirectScheme) { [weak self] callback, error in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.browserSession = nil
                defer { self.pendingVerifier = nil; self.pendingState = nil }
                guard error == nil, let callback,
                      callback.scheme == self.redirectScheme,
                      callback.host == "auth",
                      let query = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems,
                      let code = query.first(where: { $0.name == "code" })?.value,
                      let returnedState = query.first(where: { $0.name == "state" })?.value,
                      returnedState == self.pendingState, let savedVerifier = self.pendingVerifier else {
                    self.busy = false
                    self.status = "Sign-in cancelled or verification failed. Try again."
                    return
                }
                await self.exchange(code: code, verifier: savedVerifier)
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        browserSession = session
        if !session.start() {
            busy = false
            browserSession = nil
            pendingVerifier = nil
            pendingState = nil
            status = "Unable to open secure sign-in."
        }
    }

    private func request(_ path: String, method: String = "GET", body: Data? = nil, authorized: Bool = true, idempotencyKey: String? = nil) async throws -> Data {
        // URLComponents keeps the reading-offset query outside of URL path
        // encoding (appendingPathComponent would escape the '?' separator).
        let parts = path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
        var components = URLComponents(url: origin, resolvingAgainstBaseURL: false)!
        components.path = "/" + String(parts[0]).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if parts.count > 1 { components.percentEncodedQuery = String(parts[1]) }
        guard let url = components.url else { throw NSError(domain: "CABO", code: 400) }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 12
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let idempotencyKey {
            request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        }
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if authorized {
            guard let token = keychainToken() else { throw NSError(domain: "CABO", code: 401) }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let code = (response as? HTTPURLResponse)?.statusCode else { throw NSError(domain: "CABO", code: 0) }
        if code == 401 {
            clearSupportStorage()
            clearToken()
            role = nil
            summary = []; workspaces = []; materials = []; materialSummaries = []; quizzes = []; quizSummaries = []
            guardians = []; staffSchools = []; adminOrganizations = []; journey = []; learnerHelp = []
            guardianReports = []; learnerReports = []; guardianGuidance = ""
            status = "Session expired. Sign in again."
            throw NSError(domain: "CABO", code: 401)
        }
        guard (200...299).contains(code) else { throw NSError(domain: "CABO", code: code) }
        return data
    }

    private func exchange(code: String, verifier: String) async {
        do {
            let body = try JSONSerialization.data(withJSONObject: [
                "client_id": clientID, "code": code, "code_verifier": verifier
            ])
            let data = try await request("api/native/token", method: "POST", body: body, authorized: false)
            guard let response = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let token = response["access_token"] as? String,
                  token.count >= 32,
                  response["token_type"] as? String == "Bearer",
                  let expiration = response["expires_in"] as? Int,
                  (1...3600).contains(expiration) else {
                throw NSError(domain: "CABO", code: 400)
            }
            try storeToken(token)
            busy = false
            await refresh()
        } catch {
            busy = false
            status = "Could not complete native CABO login. Please try again."
        }
    }

    // Disposable pilot only. No plaintext credential is persisted, logged,
    // embedded in the app bundle, or sent to a different HTTP origin.
    func signInTest(username: String, password: String) async {
        guard testLoginAvailable, !busy else { return }
        busy = true
        status = "Signing in to isolated CABO test account…"
        do {
            let body = try JSONSerialization.data(withJSONObject: [
                "username": username, "password": password
            ])
            let data = try await request("api/native/test-login",
                method: "POST", body: body, authorized: false)
            guard let response = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let token = response["access_token"] as? String, token.count >= 32,
                  response["token_type"] as? String == "Bearer",
                  let seconds = response["expires_in"] as? Int,
                  (1...3600).contains(seconds) else {
                throw NSError(domain: "CABO", code: 400)
            }
            try storeToken(token)
            busy = false
            await refresh()
        } catch {
            busy = false
            status = "Test sign-in failed. Check the isolated server and credentials."
        }
    }

    func restore() async {
        if keychainToken() != nil {
            supportDrafts = loadSupportDrafts()
            supportCourses = loadSupportCourses()
            await refresh()
        }
    }
    func refresh() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let portal = try await request("api/portal/me")
            let decoded = try JSONSerialization.jsonObject(with: portal) as? [String: Any] ?? [:]
            let verifiedRole = decoded["role"] as? String ?? "learner"
            let nextSummary = (decoded["summary"] as? [String: Int] ?? [:])
                .map { "\($0.key): \($0.value)" }.sorted()
            let nextWorkspaces = (decoded["cards"] as? [[String: Any]] ?? [])
                .compactMap { $0["label"] as? String }
            var nextGuardians: [GuardianInvitation] = []
            var nextStaff: [StaffSchool] = []
            var nextAdminOrganizations: [String] = []
            var nextJourney: [String] = []
            var nextLearnerHelp: [String] = []
            var nextLearnerReports: [NativeLearnerReport] = []
            var nextLearnerReportNotice = ""
            var nextMaterials: [String] = []
            var nextMaterialSummaries: [NativeMaterialSummary] = []
            var nextQuizzes: [String] = []
            var nextQuizSummaries: [NativeQuizSummary] = []
            var nextGuidance = ""
            var nextGuardianReports: [NativeGuardianReport] = []
            var nextGuardianReportNotice = ""
            var nextSupportCourses: [NativeSupportCourse] = []
            var nextSupportDrafts = loadSupportDrafts()

            if verifiedRole == "superadmin" {
                // Read-only registry via audited, server-authorized endpoint.
                let data = try await request("api/platform/overview")
                let registry = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
                nextAdminOrganizations = (registry["organizations"] as? [[String: Any]] ?? [])
                    .prefix(100).compactMap { row in row["name"] as? String }
            } else if verifiedRole == "parent" {
                let parentData = try await request("api/native/mobile/parent")
                let parent = try JSONSerialization.jsonObject(with: parentData) as? [String: Any] ?? [:]
                nextGuidance = parent["guidance"] as? String ?? ""
                nextGuardians = (parent["relationships"] as? [[String: Any]] ?? []).compactMap { item in
                    guard let id = item["invitationId"] as? Int,
                          let status = item["status"] as? String else { return nil }
                    return GuardianInvitation(
                        id: id, status: status,
                        learnerName: item["learnerName"] as? String,
                        verifiedForRead: item["verifiedForRead"] as? Bool ?? false
                    )
                }
                do {
                    let data = try await request("api/native/mobile/parent/reports")
                    let envelope = try JSONDecoder().decode(NativeGuardianReportEnvelope.self, from: data)
                    nextGuardianReports = Array(envelope.reports.prefix(20))
                    nextGuardianReportNotice = envelope.guidance
                } catch {
                    if keychainToken() == nil { throw error }
                    nextGuardianReportNotice = "Verified academic reports are unavailable. Check your connection or ask the school."
                }
            } else if ["teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head"]
                        .contains(verifiedRole) {
                let organizations = Array((decoded["organizationIds"] as? [Int] ?? []).prefix(12))
                for org in organizations {
                    do {
                        let data = try await request("api/organizations/\(org)/support/options")
                        let options = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
                        let courses = (options["courses"] as? [[String: Any]] ?? [])
                            .compactMap { $0["name"] as? String }
                        var support: [String] = []
                        if let stats = try? await request("api/organizations/\(org)/support/accountability"),
                           let obj = try? JSONSerialization.jsonObject(with: stats) as? [String: Any],
                           let summary = obj["summary"] as? [String: Int] {
                            support = summary.map { "\($0.key): \($0.value)" }.sorted()
                        }
                        var supportTickets: [NativeStaffSupportTicket] = []
                        if let data = try? await request("api/organizations/\(org)/support"),
                           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                            supportTickets = Array((obj["items"] as? [[String: Any]] ?? []).prefix(20))
                                .compactMap { ticket in
                                    guard let id = ticket["id"] as? Int,
                                          let ticketOrg = ticket["organizationId"] as? Int,
                                          let courseId = ticket["courseId"] as? Int,
                                          let concept = ticket["concept"] as? String,
                                          let question = ticket["question"] as? String,
                                          let attempted = ticket["attempted"] as? String,
                                          let status = ticket["status"] as? String,
                                          let version = ticket["version"] as? Int else { return nil }
                                    return NativeStaffSupportTicket(id: id, organizationId: ticketOrg,
                                        courseId: courseId, concept: String(concept.prefix(160)),
                                        question: String(question.prefix(4000)), attempted: String(attempted.prefix(2000)),
                                        status: String(status.prefix(32)), version: max(1, version))
                                }
                        }
                        nextStaff.append(StaffSchool(
                            id: org, subjects: courses, support: support,
                            ticketSummaries: supportTickets, notice: nil
                        ))
                    } catch {
                        // Do not treat authorization failure as an empty classroom.
                        if keychainToken() == nil { throw error }
                        nextStaff.append(StaffSchool(
                            id: org, subjects: [], support: [], ticketSummaries: [],
                            notice: "This school's learning-support module may not be enabled."
                        ))
                    }
                }
            } else {
                nextMaterialSummaries = Array((try? JSONDecoder().decode([NativeMaterialSummary].self,
                    from: await request("api/materials")))?.prefix(30) ?? [])
                nextMaterials = nextMaterialSummaries.map(\.title)
                nextQuizSummaries = Array((try? JSONDecoder().decode([NativeQuizSummary].self,
                    from: await request("api/quizzes")))?.prefix(30) ?? [])
                nextQuizzes = nextQuizSummaries.map(\.title)
                let currentYear = Calendar.current.component(.year, from: Date())
                for org in Array((decoded["organizationIds"] as? [Int] ?? []).prefix(5)) {
                    do {
                        let data = try await request("api/reports/me?organizationId=\(org)&year=\(currentYear)")
                        let raw = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
                        guard let learnerId = raw["learnerId"] as? String,
                              let grade = raw["grade"] as? String,
                              let attendance = raw["attendance"] as? [String: Any] else { continue }
                        let subjects = (raw["subjects"] as? [[String: Any]] ?? []).compactMap { row -> NativeReportSubject? in
                            guard let name = row["name"] as? String,
                                  let percentage = row["percentage"] as? NSNumber else { return nil }
                            return NativeReportSubject(
                                name: name, percentage: percentage.doubleValue,
                                assessmentCount: row["assessmentCount"] as? Int ?? 0
                            )
                        }
                        let attendanceRow = NativeReportAttendance(
                            recordedDays: attendance["recordedDays"] as? Int ?? 0,
                            presentDays: attendance["presentDays"] as? Int ?? 0,
                            rate: attendance["rate"] as? Int
                        )
                        nextLearnerReports.append(NativeLearnerReport(
                            learnerId: learnerId, year: currentYear, grade: grade,
                            subjects: subjects,
                            average: (raw["average"] as? NSNumber)?.doubleValue,
                            attendance: attendanceRow, official: false,
                            visibility: "learner_only", status: "draft_preview",
                            organizationId: org
                        ))
                    } catch {
                        if keychainToken() == nil { throw error }
                        nextLearnerReportNotice = "Some academic reports could not be loaded."
                    }
                }
                let learnerOrganizations = Array((decoded["organizationIds"] as? [Int] ?? []).prefix(12))
                for org in learnerOrganizations {
                    if let data = try? await request("api/organizations/\(org)/support/options"),
                       let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        nextSupportCourses += (obj["courses"] as? [[String: Any]] ?? []).compactMap { row in
                            guard let courseId = row["id"] as? Int,
                                  let name = row["name"] as? String,
                                  courseId > 0, !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
                            return NativeSupportCourse(organizationId: org, courseId: courseId, name: String(name.prefix(120)))
                        }
                    }
                }
                for org in learnerOrganizations.prefix(3) {
                    if let data = try? await request("api/organizations/\(org)/support"),
                       let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        let items = Array((obj["items"] as? [[String: Any]] ?? []).prefix(15))
                        nextLearnerHelp += items.compactMap { row in
                            guard let topic = row["concept"] as? String else { return nil }
                            return "\(String(topic.prefix(80))) · \(row["status"] as? String ?? "open")"
                        }
                    }
                }
                if let data = try? await request("api/learner-journey/me"),
                   let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let stages = (obj["journeys"] as? [Any])?.count ?? 0
                    let milestones = (obj["milestones"] as? [Any])?.count ?? 0
                    nextJourney = ["Learning stages: \(stages)", "Milestones: \(milestones)"]
                }
                if !nextSupportCourses.isEmpty { storeSupportCourses(nextSupportCourses) }
                else { nextSupportCourses = loadSupportCourses() }
            }
            // One of the nested requests may have cleared credentials after a 401.
            guard keychainToken() != nil else { throw NSError(domain: "CABO", code: 401) }
            role = verifiedRole
            summary = nextSummary
            workspaces = nextWorkspaces
            guardians = nextGuardians
            guardianGuidance = nextGuidance
            guardianReports = nextGuardianReports
            guardianReportNotice = nextGuardianReportNotice
            staffSchools = nextStaff
            adminOrganizations = nextAdminOrganizations
            journey = nextJourney
            learnerHelp = Array(nextLearnerHelp.prefix(20))
            learnerReports = nextLearnerReports
            learnerReportNotice = nextLearnerReportNotice
            supportCourses = nextSupportCourses
            supportDrafts = nextSupportDrafts
            materials = nextMaterials
            materialSummaries = nextMaterialSummaries
            quizzes = nextQuizzes
            quizSummaries = nextQuizSummaries
            status = "Connected securely to CABO"
        } catch {
            if keychainToken() == nil { clearSupportStorage() }
            role = nil; summary = []; workspaces = []; materials = []; quizzes = []; quizSummaries = []; materialSummaries = []
            guardians = []; staffSchools = []; adminOrganizations = []; journey = []; learnerHelp = []; guardianGuidance = ""; guardianReports = []; guardianReportNotice = ""; learnerReports = []; learnerReportNotice = ""
            supportDrafts = loadSupportDrafts()
            supportCourses = loadSupportCourses()
            status = keychainToken() == nil
                ? "Session expired. Sign in again."
                : "Could not load CABO. Check your connection and retry."
        }
    }

    func saveSupportDraft(course: NativeSupportCourse, concept: String, question: String, attempted: String) throws -> NativeSupportDraft {
        guard role == "learner", supportCourses.contains(course) else { throw NSError(domain: "CABO", code: 403) }
        let cleanConcept = concept.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanQuestion = question.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanAttempted = attempted.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (2...160).contains(cleanConcept.count), (10...4000).contains(cleanQuestion.count),
              (3...2000).contains(cleanAttempted.count) else {
            throw NSError(domain: "CABO", code: 400,
                          userInfo: [NSLocalizedDescriptionKey: "Add a concept, a question, and what you have tried."])
        }
        let draft = NativeSupportDraft(requestKey: UUID().uuidString.lowercased(),
            organizationId: course.organizationId, courseId: course.courseId, courseName: course.name,
            concept: cleanConcept, question: cleanQuestion, attempted: cleanAttempted)
        let updated = (loadSupportDrafts().filter { $0.requestKey != draft.requestKey } + [draft]).suffix(20)
        try storeSupportDrafts(Array(updated))
        supportDrafts = Array(updated)
        return draft
    }

    func deleteSupportDraft(_ requestKey: String) throws {
        let updated = loadSupportDrafts().filter { $0.requestKey != requestKey }
        try storeSupportDrafts(updated)
        supportDrafts = updated
    }

    func sendSupportDraft(_ draft: NativeSupportDraft) async throws {
        guard role == "learner", supportDrafts.contains(where: { $0.requestKey == draft.requestKey }) else {
            throw NSError(domain: "CABO", code: 403)
        }
        let body = try JSONSerialization.data(withJSONObject: [
            "courseId": draft.courseId, "concept": draft.concept, "question": draft.question,
            "attempted": draft.attempted, "requestKey": draft.requestKey
        ])
        let data = try await request("api/organizations/\(draft.organizationId)/support",
                                     method: "POST", body: body, idempotencyKey: draft.requestKey)
        guard let ticket = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = ticket["id"] as? Int, id > 0,
              ticket["requestKey"] as? String == draft.requestKey,
              ticket["organizationId"] as? Int == draft.organizationId,
              ticket["courseId"] as? Int == draft.courseId else {
            throw NSError(domain: "CABO", code: 502,
                          userInfo: [NSLocalizedDescriptionKey: "CABO could not confirm this support request."])
        }
        try deleteSupportDraft(draft.requestKey)
        await refresh()
    }

    func replyToSupportTicket(_ ticket: NativeStaffSupportTicket, body: String) async throws {
        try await sendStaffSupportAction(ticket, action: ["kind": "reply", "body": body])
    }

    func triageSupportTicket(_ ticket: NativeStaffSupportTicket, reason: String) async throws {
        try await sendStaffSupportAction(ticket, action: ["kind": "transition", "status": "triaged", "reason": reason])
    }

    private func sendStaffSupportAction(_ ticket: NativeStaffSupportTicket, action: [String: Any]) async throws {
        guard ["teacher", "assessor"].contains(role ?? "") else {
            throw NSError(domain: "CABO", code: 403)
        }
        let body = try JSONSerialization.data(withJSONObject: ["version": ticket.version, "action": action])
        let data = try await request("api/organizations/\(ticket.organizationId)/support/\(ticket.id)/actions",
                                     method: "POST", body: body)
        guard let updated = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              updated["id"] as? Int == ticket.id,
              (updated["version"] as? Int ?? 0) == ticket.version + 1 else {
            throw NSError(domain: "CABO", code: 409,
                          userInfo: [NSLocalizedDescriptionKey: "This request changed. Refresh before trying again."])
        }
        await refresh()
    }

    private func supportOwnerId() -> String? {
        guard let token = keychainToken() else { return nil }
        return SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private func loadSupportDrafts() -> [NativeSupportDraft] {
        guard let owner = supportOwnerId(), let data = keychainData(account: "support_drafts"),
              let store = try? JSONDecoder().decode(NativeSupportDraftStore.self, from: data),
              store.ownerId == owner else { return [] }
        return Array(store.drafts.suffix(20))
    }

    private func storeSupportDrafts(_ drafts: [NativeSupportDraft]) throws {
        guard let owner = supportOwnerId() else { throw NSError(domain: "CABO", code: 401) }
        let data = try JSONEncoder().encode(NativeSupportDraftStore(ownerId: owner, drafts: Array(drafts.suffix(20))))
        try storeKeychainData(data, account: "support_drafts")
    }

    private func loadSupportCourses() -> [NativeSupportCourse] {
        guard let owner = supportOwnerId(), let data = keychainData(account: "support_courses"),
              let store = try? JSONDecoder().decode(NativeSupportCourseStore.self, from: data),
              store.ownerId == owner else { return [] }
        return Array(store.courses.prefix(100))
    }

    private func storeSupportCourses(_ courses: [NativeSupportCourse]) {
        guard let owner = supportOwnerId(),
              let data = try? JSONEncoder().encode(NativeSupportCourseStore(ownerId: owner, courses: Array(courses.prefix(100)))) else { return }
        try? storeKeychainData(data, account: "support_courses")
    }

    private func clearSupportStorage() {
        deleteKeychainData(account: "support_drafts")
        deleteKeychainData(account: "support_courses")
        supportDrafts = []
        supportCourses = []
    }

    // Account-scoped, paged source text. Never cache private learner documents
    // to persistent storage without a reviewed offline permission policy.
    func loadMaterialPreview(id: Int, offset: Int) async throws -> NativeMaterialPage {
        guard role != nil, id > 0, offset >= 0 else {
            throw NSError(domain: "CABO", code: 400)
        }
        let data = try await request("api/materials/\(id)/preview?offset=\(offset)")
        return try JSONDecoder().decode(NativeMaterialPage.self, from: data)
    }

    // Native study uploads mirror the web flow without storing document bytes
    // or credentials beyond the signed-in request. The backend owns access,
    // size checks, upload intents, and final material authorization.
    func uploadMaterial(fileURL: URL, title: String) async throws {
        guard role != nil else { throw NSError(domain: "CABO", code: 401) }
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty, cleanTitle.count <= 200 else {
            throw NSError(domain: "CABO", code: 400,
                          userInfo: [NSLocalizedDescriptionKey: "Enter a title of 1 to 200 characters."])
        }

        let supportedTypes: [String: String] = [
            "txt": "text/plain", "md": "text/markdown", "csv": "text/csv",
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"
        ]
        let fileName = fileURL.lastPathComponent
        let fileExtension = fileURL.pathExtension.lowercased()
        guard let contentType = supportedTypes[fileExtension] else {
            throw NSError(domain: "CABO", code: 415,
                          userInfo: [NSLocalizedDescriptionKey: "Choose a supported PDF, Office, text, CSV, PNG, JPEG or WebP file."])
        }

        let hasScope = fileURL.startAccessingSecurityScopedResource()
        defer { if hasScope { fileURL.stopAccessingSecurityScopedResource() } }
        let values = try fileURL.resourceValues(forKeys: [.fileSizeKey])
        guard let byteCount = values.fileSize, byteCount > 0, byteCount <= 30 * 1024 * 1024 else {
            throw NSError(domain: "CABO", code: 413,
                          userInfo: [NSLocalizedDescriptionKey: "Files must be between 1 byte and 30 MB."])
        }

        let staged = FileManager.default.temporaryDirectory
            .appendingPathComponent("cabo-material-\(UUID().uuidString).upload")
        defer { try? FileManager.default.removeItem(at: staged) }
        try FileManager.default.copyItem(at: fileURL, to: staged)

        let uploadIntentBody = try JSONSerialization.data(withJSONObject: [
            "name": fileName, "size": byteCount, "contentType": contentType,
            "allowAiReading": false
        ])
        let intentData = try await request("api/storage/uploads/request-url", method: "POST", body: uploadIntentBody)
        guard let intent = try JSONSerialization.jsonObject(with: intentData) as? [String: Any],
              let uploadText = intent["uploadURL"] as? String,
              let objectPath = intent["objectPath"] as? String,
              let uploadURL = URL(string: uploadText),
              let originHost = origin.host, let uploadHost = uploadURL.host,
              uploadURL.scheme?.lowercased() == "https",
              uploadURL.user == nil, uploadURL.password == nil,
              uploadURL.fragment == nil else {
            throw NSError(domain: "CABO", code: 502,
                          userInfo: [NSLocalizedDescriptionKey: "CABO returned an invalid secure upload destination."])
        }
        let originPort = origin.port ?? 443
        let uploadPort = uploadURL.port ?? 443
        let sameAPIOrigin = originHost.caseInsensitiveCompare(uploadHost) == .orderedSame && originPort == uploadPort
        let testUploadPath = sameAPIOrigin && uploadURL.path.range(
            of: #"^/api/storage/uploads/railway/[a-f0-9-]{36}$"#, options: .regularExpression
        ) != nil
        if sameAPIOrigin && !testUploadPath {
            throw NSError(domain: "CABO", code: 502,
                          userInfo: [NSLocalizedDescriptionKey: "CABO returned an unexpected upload destination."])
        }

        var uploadRequest = URLRequest(url: uploadURL)
        uploadRequest.httpMethod = "PUT"
        uploadRequest.timeoutInterval = 60
        uploadRequest.cachePolicy = .reloadIgnoringLocalCacheData
        uploadRequest.setValue(contentType, forHTTPHeaderField: "Content-Type")
        // Test storage is same-origin and authenticated. Real signed storage
        // URLs receive no CABO bearer token.
        if testUploadPath {
            guard let token = keychainToken() else { throw NSError(domain: "CABO", code: 401) }
            uploadRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let uploadConfiguration = URLSessionConfiguration.ephemeral
        uploadConfiguration.httpCookieStorage = nil
        uploadConfiguration.httpShouldSetCookies = false
        let uploadSession = URLSession(configuration: uploadConfiguration)
        defer { uploadSession.invalidateAndCancel() }
        let (_, uploadResponse) = try await uploadSession.upload(for: uploadRequest, fromFile: staged)
        guard let uploadStatus = (uploadResponse as? HTTPURLResponse)?.statusCode,
              (200...299).contains(uploadStatus) else {
            throw NSError(domain: "CABO", code: 502,
                          userInfo: [NSLocalizedDescriptionKey: "The file upload was not accepted. Please retry."])
        }

        let materialBody = try JSONSerialization.data(withJSONObject: ["title": cleanTitle, "objectPath": objectPath])
        let savedData = try await request("api/materials", method: "POST", body: materialBody)
        guard let saved = try JSONSerialization.jsonObject(with: savedData) as? [String: Any],
              let id = saved["id"] as? Int, id > 0,
              let savedTitle = saved["title"] as? String, !savedTitle.isEmpty else {
            throw NSError(domain: "CABO", code: 502,
                          userInfo: [NSLocalizedDescriptionKey: "CABO could not confirm the uploaded material."])
        }
    }

    // Source-of-truth practice assessment API. All results are returned by the server;
    // no correct answers or fabricated grades are built into the app.
    func loadQuiz(id: Int) async throws -> NativePracticeQuiz {
        guard role != nil, id > 0 else { throw NSError(domain: "CABO", code: 401) }
        let data = try await request("api/quizzes/\(id)")
        return try JSONDecoder().decode(NativePracticeQuiz.self, from: data)
    }

    func submitQuiz(id: Int, answers: [Int], requestKey: String) async throws -> NativeQuizAttempt {
        guard role != nil, id > 0, !answers.isEmpty, answers.allSatisfy({ $0 >= 0 }) else {
            throw NSError(domain: "CABO", code: 400)
        }
        let payload = try JSONEncoder().encode(NativeQuizAnswers(answers: answers))
        let data = try await request("api/quizzes/\(id)/attempts",
                                     method: "POST", body: payload,
                                     idempotencyKey: requestKey)
        return try JSONDecoder().decode(NativeQuizAttempt.self, from: data)
    }

    // Read-only result recovery. Never make a second POST after a timeout.
    func findSubmittedQuiz(id: Int, requestKey: String) async throws -> NativeQuizAttempt {
        guard role != nil, id > 0, !requestKey.isEmpty else {
            throw NSError(domain: "CABO", code: 400)
        }
        let data = try await request("api/quizzes/\(id)/attempts/by-key/\(requestKey)")
        return try JSONDecoder().decode(NativeQuizAttempt.self, from: data)
    }

    private struct NativeQuizAnswers: Encodable {
        let answers: [Int]
    }

    func decideGuardian(invitationId: Int, accept: Bool) async {
        guard !busy, invitationId > 0 else { return }
        busy = true
        do {
            let body = try JSONSerialization.data(withJSONObject: [
                "decision": accept ? "accepted" : "declined"
            ])
            _ = try await request(
                "api/guardian-relationships/\(invitationId)/decision",
                method: "POST", body: body
            )
            busy = false
            await refresh()
            status = accept ? "Invitation accepted. School verification is still required."
                            : "Invitation declined."
        } catch {
            busy = false
            status = "Unable to update invitation. Please retry."
        }
    }

    func signOut() async {
        guard !busy else { return }
        busy = true
        // Revoke server-side token while still available, then always clear it
        // from Keychain even when the network is unavailable.
        if let token = keychainToken() {
            var request = URLRequest(url: origin.appendingPathComponent("api/native/logout"))
            request.httpMethod = "POST"
            request.timeoutInterval = 6
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            _ = try? await URLSession.shared.data(for: request)
        }
        clearSupportStorage()
        clearToken()
        role = nil; summary = []; workspaces = []; materials = []; quizzes = []; quizSummaries = []; materialSummaries = []
        guardians = []; staffSchools = []; adminOrganizations = []; journey = []; learnerHelp = []; guardianGuidance = ""; guardianReports = []; guardianReportNotice = ""; learnerReports = []; learnerReportNotice = ""
        status = "Signed out on this device."
        busy = false
    }

    private struct NativeResource: Decodable { let title: String }

    private func keychainToken() -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "za.co.cabosolutions.learninghub.native",
            kSecAttrAccount as String: "native_bearer",
            kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    private func storeToken(_ token: String) throws {
        clearSupportStorage()
        clearToken()
        let attributes: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "za.co.cabosolutions.learninghub.native",
            kSecAttrAccount as String: "native_bearer",
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData as String: Data(token.utf8)]
        guard SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess else {
            throw NSError(domain: "CABO", code: 500)
        }
    }
    private func clearToken() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "za.co.cabosolutions.learninghub.native",
            kSecAttrAccount as String: "native_bearer"]
        SecItemDelete(query as CFDictionary)
    }

    private func keychainData(account: String) -> Data? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "za.co.cabosolutions.learninghub.native",
            kSecAttrAccount as String: account,
            kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return data
    }

    private func storeKeychainData(_ data: Data, account: String) throws {
        deleteKeychainData(account: account)
        let attributes: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "za.co.cabosolutions.learninghub.native",
            kSecAttrAccount as String: account,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData as String: data]
        guard SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess else {
            throw NSError(domain: "CABO", code: 500,
                          userInfo: [NSLocalizedDescriptionKey: "Could not securely save this draft on this device."])
        }
    }

    private func deleteKeychainData(account: String) {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "za.co.cabosolutions.learninghub.native",
            kSecAttrAccount as String: account]
        SecItemDelete(query as CFDictionary)
    }
}
