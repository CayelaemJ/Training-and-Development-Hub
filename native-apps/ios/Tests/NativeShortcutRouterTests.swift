import XCTest
@testable import CABOLearningHub

final class NativeShortcutRouterTests: XCTestCase {
    func testOnlyKnownDestinationsAreAccepted() {
        let router = NativeShortcutRouter()
        router.request("support")
        XCTAssertEqual(router.pending, "support")
        router.request("settings://delete-account")
        XCTAssertEqual(router.pending, "support", "unknown destinations are ignored")
    }
}
