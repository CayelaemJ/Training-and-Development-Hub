import XCTest
@testable import CABOLearningHub

final class NativeChildProgressTests: XCTestCase {
    private func sample(visibility: String = "verified_guardian", organizationId: Int = 12, status: String = "watch") -> Data {
        """
        {"learnerId":"cabo-fixture-learner-south-a","learnerName":"Lerato Mahlobo","organizationId":\(organizationId),
         "organization":"[DEMO] Ubuntu Future","grade":"Grade 12","year":2026,"visibility":"\(visibility)","official":false,
         "overall":{"current":72.5,"previous":68,"change":4.5,"trend":"improving","terms":[{"period":"Term 1","percentage":68},{"period":"Term 2","percentage":72.5}]},
         "outlook":{"status":"\(status)","reasons":["one or more subjects need watching"]},
         "subjects":[{"subject":"Mathematics","terms":[],"current":82,"previous":80,"change":2,"trend":"steady","latestTerm":"Term 2","assessments":2,
                      "outlook":{"status":"on_track","reason":""},"standing":{"available":true,"cohortSize":6,"classAverage":70,"band":"top_quarter","differenceFromAverage":12}},
                     {"subject":"Physical Sciences","terms":[],"current":55,"previous":62,"change":-7,"trend":"declining","latestTerm":"Term 2","assessments":1,
                      "outlook":{"status":"watch","reason":"Result dropped"},"standing":{"available":false,"reason":"Shown only when at least 5 learners have results"}}],
         "highlights":{"strongest":["Mathematics"],"mostImproved":[],"focusAreas":[{"subject":"Physical Sciences","status":"watch","reason":"Result dropped"}]},
         "attendance":{"recordedDays":40,"rate":92.5,"recentRate":95,"earlierRate":90,"trend":"steady"},
         "recentResults":[{"subject":"Mathematics","assessment":"Test 2","percentage":82,"publishedAt":"2026-05-01T00:00:00.000Z"}],
         "method":{"publishedOnly":true,"minCohortForComparison":5,"notAPrediction":"Not a forecast."}}
        """.data(using: .utf8)!
    }

    func testDecodesTheServerProjection() throws {
        let progress = try XCTUnwrap(NativeChildProgress.decodeVerified(sample()))
        XCTAssertEqual(progress.outlook.status, "watch")
        XCTAssertEqual(progress.subjects.count, 2)
        XCTAssertEqual(progress.subjects[0].standing.classAverage, 70)
        XCTAssertFalse(progress.subjects[1].standing.available)
        XCTAssertNil(progress.subjects[1].standing.classAverage)
        XCTAssertEqual(progress.attendance.rate, 92.5)
        XCTAssertEqual(progress.method.notAPrediction, "Not a forecast.")
    }

    func testRefusesResponsesNotAddressedToAVerifiedGuardian() {
        XCTAssertNil(NativeChildProgress.decodeVerified(sample(visibility: "public")))
        XCTAssertNil(NativeChildProgress.decodeVerified(sample(organizationId: 0)))
        XCTAssertNil(NativeChildProgress.decodeVerified(Data("{}".utf8)))
    }

    func testUnknownOutlookFallsBackAndLabelsAreParentFriendly() throws {
        let progress = try XCTUnwrap(NativeChildProgress.decodeVerified(sample(status: "excellent")))
        XCTAssertEqual(progress.outlook.status, "not_enough_data")
        XCTAssertEqual(NativeChildProgress.outlookLabel("watch"), "Worth watching")
        XCTAssertEqual(NativeChildProgress.trendLabel("declining", -7), "Declining (-7 pts)")
        XCTAssertEqual(NativeChildProgress.bandLabel("top_quarter"), "Top quarter of the class")
        XCTAssertEqual(NativeChildProgress.format(72.5), "72.5")
    }
}
