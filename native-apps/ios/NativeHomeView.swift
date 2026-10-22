import SwiftUI

private struct LearningArea: Identifiable {
    let title: String
    let detail: String
    var id: String { title }
}

struct NativeHomeView: View {
    @State private var connection = "Checking CABO service…"
    private let clay = Color(red: 196 / 255, green: 103 / 255, blue: 58 / 255)
    private let areas = [
        LearningArea(title: "My learning", detail: "Lessons and personal progress"),
        LearningArea(title: "Practice tests", detail: "Questions, results and feedback"),
        LearningArea(title: "Academic journey", detail: "Subjects and milestones"),
        LearningArea(title: "Sports and activities", detail: "Development and achievements"),
        LearningArea(title: "Teacher support", detail: "Get help when learning is difficult")
    ]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Your learning journey")
                            .font(.title2.bold())
                        Text("A native iPhone and iPad CABO experience")
                        Text(connection)
                            .foregroundStyle(.secondary)
                        Link("Sign in securely in Safari",
                             destination: URL(string: "https://cabo-learning-hub-pilot.onrender.com/api/login")!)
                            .buttonStyle(.borderedProminent)
                        Text("Authenticated native screens are not yet enabled. No private learner data is downloaded.")
                            .font(.caption)
                    }
                    .padding(.vertical, 8)
                }
                Section("Learning areas") {
                    ForEach(areas) { area in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(area.title).font(.headline)
                            Text(area.detail).font(.subheadline).foregroundStyle(.secondary)
                            Text("Coming to native CABO").font(.caption2).foregroundStyle(clay)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("CABO Learning Hub")
            .task { await checkService() }
        }
        .tint(clay)
    }

    @MainActor
    private func checkService() async {
        guard let url = URL(string: "https://cabo-learning-hub-pilot.onrender.com/api/auth/user") else { return }
        var request = URLRequest(url: url)
        request.timeoutInterval = 8
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            connection = code == 200 ? "CABO service reachable · Sign in required" : "CABO service returned HTTP \(code)"
        } catch {
            connection = "Cannot reach CABO. Check your internet connection."
        }
    }
}
