import XCTest
@testable import CABOLearningHub

// NativeSession is main-actor isolated (it presents the sign-in sheet), so
// these tests run on the main actor.
@MainActor
final class NativeSessionIsolationTests: XCTestCase {
    func testResetClearsEveryAccountScopedRecord() throws {
        let session = NativeSession()
        XCTAssertTrue(session.accountStateIsEmpty)

        session.role = "learner"
        session.summary = ["materials: 3"]
        session.materialSummaries = [NativeMaterialSummary(id: 7, title: "Biology notes")]
        session.journeyIdentity = NativeJourneyIdentity(displayName: "Learner A")
        session.notificationPreferences = NativeNotificationPreferences(enabled: true, optInAvailable: true,
            schools: [NativeNotificationPreferenceSchool(id: 1, name: "School A", choices: [])])
        session.guardianReportNotice = "Reports for learner A"
        session.educationCommandNotice = "School A aggregates"
        let replyData = try JSONSerialization.data(withJSONObject: [
            "materialId": 7, "materialTitle": "Biology notes",
            "answer": "Plants use light to make glucose.",
            "citations": [["excerpt": "Photosynthesis converts light energy into chemical energy."]],
            "reviewRequired": true
        ])
        let answer = try NativeMaterialTutor.decodeAnswer(replyData, expectedMaterialId: 7)
        session.materialAnswers[7] = [NativeTutorExchange(id: UUID(), question: "What is photosynthesis?", answer: answer)]
        XCTAssertFalse(session.accountStateIsEmpty)

        let generation = session.accountGeneration
        session.resetAccountState()

        XCTAssertTrue(session.accountStateIsEmpty)
        XCTAssertTrue(session.notificationPreferences.schools.isEmpty)
        XCTAssertTrue(session.materialAnswers.isEmpty)
        XCTAssertEqual(session.educationCommandNotice, "")
        XCTAssertGreaterThan(session.accountGeneration, generation)
    }

    func testTutorRefusesBeforeSignInWithoutNetworkCall() async {
        let session = NativeSession()
        do {
            try await session.askMaterial(id: 7, question: "What is photosynthesis?")
            XCTFail("A signed-out session must not ask the tutor")
        } catch {
            XCTAssertEqual((error as NSError).code, 403)
        }
        XCTAssertTrue(session.materialAnswers.isEmpty)
    }
}
