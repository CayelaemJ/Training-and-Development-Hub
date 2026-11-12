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
}
