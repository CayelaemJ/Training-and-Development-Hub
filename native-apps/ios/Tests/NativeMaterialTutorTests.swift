import XCTest
@testable import CABOLearningHub

final class NativeMaterialTutorTests: XCTestCase {
    private let excerpt = "Photosynthesis converts light energy into chemical energy in plants."

    private func reply(materialId: Int = 7, answer: String = "Plants use light to make glucose, as the notes explain.",
                       citations: [String]? = nil, reviewRequired: Bool = true) -> Data {
        let body: [String: Any] = [
            "materialId": materialId, "materialTitle": "Biology notes", "answer": answer,
            "citations": (citations ?? [excerpt]).map { ["excerpt": $0] },
            "modelId": "test-model", "reviewRequired": reviewRequired
        ]
        return try! JSONSerialization.data(withJSONObject: body)
    }

    func testQuestionIsTrimmedAndBoundedLikeTheServer() {
        XCTAssertEqual(NativeMaterialTutor.validatedQuestion("  What is osmosis?  \n"), "What is osmosis?")
        XCTAssertNil(NativeMaterialTutor.validatedQuestion("   why "))
        XCTAssertNil(NativeMaterialTutor.validatedQuestion(String(repeating: "a", count: 2001)))
        XCTAssertNotNil(NativeMaterialTutor.validatedQuestion(String(repeating: "a", count: 2000)))
    }

    func testValidGroundedAnswerDecodes() throws {
        let answer = try NativeMaterialTutor.decodeAnswer(reply(), expectedMaterialId: 7)
        XCTAssertEqual(answer.materialId, 7)
        XCTAssertEqual(answer.citations.map(\.excerpt), [excerpt])
        XCTAssertTrue(answer.reviewRequired)
    }

    func testAnswerIsAlwaysMarkedForReview() throws {
        let answer = try NativeMaterialTutor.decodeAnswer(reply(reviewRequired: false), expectedMaterialId: 7)
        XCTAssertTrue(answer.reviewRequired)
    }

    func testAnswerForAnotherMaterialIsRejected() {
        XCTAssertThrowsError(try NativeMaterialTutor.decodeAnswer(reply(materialId: 8), expectedMaterialId: 7)) {
            XCTAssertEqual($0 as? NativeTutorError, .invalidResponse)
        }
    }

    func testUncitedOrMalformedAnswersAreRejected() {
        let cases: [Data] = [
            reply(citations: []),
            reply(citations: Array(repeating: excerpt, count: 5)),
            reply(citations: ["too short"]),
            reply(answer: "   "),
            reply(answer: String(repeating: "x", count: 5001)),
            Data("{\"error\":\"nope\"}".utf8),
            Data("not json".utf8)
        ]
        for data in cases {
            XCTAssertThrowsError(try NativeMaterialTutor.decodeAnswer(data, expectedMaterialId: 7))
        }
    }

    func testHistoryKeepsOnlyRecentExchanges() throws {
        let answer = try NativeMaterialTutor.decodeAnswer(reply(), expectedMaterialId: 7)
        var history: [NativeTutorExchange] = []
        for index in 0..<15 {
            history = NativeMaterialTutor.appending(
                NativeTutorExchange(id: UUID(), question: "Question \(index)", answer: answer), to: history)
        }
        XCTAssertEqual(history.count, NativeMaterialTutor.historyLimit)
        XCTAssertEqual(history.first?.question, "Question 5")
        XCTAssertEqual(history.last?.question, "Question 14")
    }

    func testFailuresMapToSafeLearnerMessages() {
        XCTAssertTrue(NativeMaterialTutor.message(for: NSError(domain: "CABO", code: 429)).contains("Wait"))
        XCTAssertTrue(NativeMaterialTutor.message(for: NSError(domain: "CABO", code: 503)).contains("not available"))
        XCTAssertTrue(NativeMaterialTutor.message(for: NSError(domain: "CABO", code: 404)).contains("not available to your account"))
        XCTAssertTrue(NativeMaterialTutor.message(for: URLError(.timedOut)).contains("too long"))
        XCTAssertTrue(NativeMaterialTutor.message(for: URLError(.notConnectedToInternet)).contains("offline"))
        XCTAssertTrue(NativeMaterialTutor.message(for: NativeTutorError.accountChanged).contains("account changed"))
        // Unknown errors never echo internal detail.
        let internalError = NSError(domain: "Other", code: 1, userInfo: [NSLocalizedDescriptionKey: "db host 10.0.0.1"])
        XCTAssertFalse(NativeMaterialTutor.message(for: internalError).contains("10.0.0.1"))
    }
}
