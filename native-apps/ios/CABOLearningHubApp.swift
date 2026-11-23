import SwiftUI

@main
struct CABOLearningHubApp: App {
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ZStack {
                NativeHomeView()
                // iOS snapshots the screen for the app switcher when the app
                // leaves the foreground. Cover learner, family and school
                // records so they are not captured in that snapshot.
                if scenePhase != .active {
                    NativePrivacyShield()
                        .transition(.opacity)
                }
            }
        }
    }
}

struct NativePrivacyShield: View {
    var body: some View {
        ZStack {
            Color(red: 13 / 255, green: 17 / 255, blue: 23 / 255).ignoresSafeArea()
            VStack(spacing: 12) {
                Text("CABO").font(.largeTitle.bold())
                    .foregroundColor(Color(red: 196 / 255, green: 103 / 255, blue: 58 / 255))
                Text("Learning Hub").font(.headline).foregroundColor(.white)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("CABO Learning Hub content hidden while the app is not active")
    }
}
