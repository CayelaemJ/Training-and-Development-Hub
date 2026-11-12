import XCTest
@testable import CABOLearningHub

final class NativeSchoolProgressionReviewTests: XCTestCase {
    func testTargetYearUsesTheYearThatWasActuallyReviewed() {
        XCTAssertEqual(
            NativeSchoolProgressionReview.targetYear(selection: "2026", snapshotYear: 2026, candidateYear: 2026),
            2027
        )
        XCTAssertNil(NativeSchoolProgressionReview.targetYear(selection: "2027", snapshotYear: 2026, candidateYear: 2026))
        XCTAssertNil(NativeSchoolProgressionReview.targetYear(selection: "not-a-year", snapshotYear: 2026, candidateYear: 2026))
        XCTAssertNil(NativeSchoolProgressionReview.targetYear(selection: "2026", snapshotYear: 2026, candidateYear: 2025))
    }

    func testLifelongPassportDecodesPrivatePreferencesAndSelfReportedEvidence() throws {
        let data = #"{"preferences":{"learningContext":"career_change","preferredLanguage":"English","learningGoal":"Build a portfolio"},"links":[{"id":7,"provider":"GitHub","url":"https://github.com/example","description":"Project work","evidenceType":"project","verificationStatus":"self_reported"}],"competencies":[{"id":9,"skill":"Data analysis","category":"technical","masteryLevel":3,"demonstration":"project","description":"Built a report from a public dataset.","evidenceLinkId":7,"verificationStatus":"self_reported"}]}"#.data(using: .utf8)!
        let passport = try JSONDecoder().decode(NativeLifelongLearningPassport.self, from: data)

        XCTAssertEqual(passport.preferences.learningContext, "career_change")
        XCTAssertEqual(passport.links.first?.url, "https://github.com/example")
        XCTAssertEqual(passport.competencies.first?.masteryLevel, 3)
        XCTAssertEqual(passport.competencies.first?.evidenceLinkId, 7)
    }
}
