import Foundation
#if canImport(AppIntents)
import AppIntents
#endif

/// Where a Siri or Shortcuts request asked the app to go. The intents only
/// OPEN a part of the app; nothing is read or spoken back, so no school data
/// leaves the signed-in session through Siri.
final class NativeShortcutRouter: ObservableObject {
    static let shared = NativeShortcutRouter()
    @Published var pending: String?
    static let destinations: Set<String> = ["support", "journey", "passport"]
    func request(_ destination: String) {
        guard Self.destinations.contains(destination) else { return }
        pending = destination
    }
}

#if canImport(AppIntents)
@available(iOS 16.0, *)
struct OpenCABOHelpIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask a teacher for help"
    static var description = IntentDescription("Opens CABO's help requests so you can ask your teacher a question.")
    static var openAppWhenRun = true
    @MainActor func perform() async throws -> some IntentResult {
        NativeShortcutRouter.shared.request("support")
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenCABOJourneyIntent: AppIntent {
    static var title: LocalizedStringResource = "Show my learning journey"
    static var description = IntentDescription("Opens your schools, years and milestones in CABO.")
    static var openAppWhenRun = true
    @MainActor func perform() async throws -> some IntentResult {
        NativeShortcutRouter.shared.request("journey")
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenCABOPassportIntent: AppIntent {
    static var title: LocalizedStringResource = "Open my learning passport"
    static var description = IntentDescription("Opens your skills and evidence in CABO.")
    static var openAppWhenRun = true
    @MainActor func perform() async throws -> some IntentResult {
        NativeShortcutRouter.shared.request("passport")
        return .result()
    }
}

@available(iOS 16.0, *)
struct CABOAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: OpenCABOHelpIntent(), phrases: ["Ask for help in \(.applicationName)", "Ask my teacher in \(.applicationName)"])
        AppShortcut(intent: OpenCABOJourneyIntent(), phrases: ["Show my learning journey in \(.applicationName)", "Show my progress in \(.applicationName)"])
        AppShortcut(intent: OpenCABOPassportIntent(), phrases: ["Open my passport in \(.applicationName)"])
    }
}
#endif
