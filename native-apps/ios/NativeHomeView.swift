import SwiftUI

// All visible views are native SwiftUI controls, not embedded HTML.
struct NativeHomeView: View {
    @StateObject private var session = NativeSession()
    private let clay = Color(red: 196.0 / 255.0, green: 103.0 / 255.0, blue: 58.0 / 255.0)

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Your learning journey").font(.title2.bold())
                        Text(session.status).foregroundStyle(.secondary)
                        if session.busy { ProgressView("Connecting securely…") }
                        if session.role == nil {
                            Button("Sign in securely") { session.signIn() }
                                .buttonStyle(.borderedProminent).disabled(session.busy)
                        } else {
                            HStack {
                                Button("Refresh") { Task { await session.refresh() } }
                                    .disabled(session.busy)
                                Button("Sign out", role: .destructive) {
                                    Task { await session.signOut() }
                                }.disabled(session.busy)
                            }.buttonStyle(.bordered)
                        }
                        Text("Private records come from CABO's authenticated API. No learner data is cached offline.")
                            .font(.caption)
                    }.padding(.vertical, 8)
                }
                if let role = session.role {
                    Section("My role") { Text(role.capitalized) }
                    if !session.summary.isEmpty {
                        Section("My progress") {
                            ForEach(session.summary, id: \.self) { Text($0) }
                        }
                    }
                    if !session.workspaces.isEmpty {
                        Section("My workspaces") {
                            ForEach(session.workspaces, id: \.self) { name in
                                Label(name, systemImage: "square.grid.2x2")
                            }
                        }
                    }
                    Section("My study materials") {
                        if session.materials.isEmpty { Text("No materials to show yet").foregroundStyle(.secondary) }
                        ForEach(session.materials, id: \.self) { title in Label(title, systemImage: "book") }
                    }
                    Section("My practice tests") {
                        if session.quizzes.isEmpty { Text("No practice tests to show yet").foregroundStyle(.secondary) }
                        ForEach(session.quizzes, id: \.self) { title in Label(title, systemImage: "checkmark.circle") }
                    }
                } else {
                    Section("Explore CABO") {
                        Label("Study materials", systemImage: "book")
                        Label("Practice tests", systemImage: "checkmark.circle")
                        Label("Academic journey", systemImage: "graduationcap")
                        Label("Sports and activities", systemImage: "figure.run")
                        Label("Teacher support", systemImage: "person.2")
                    }
                }
            }
            .navigationTitle("CABO Learning Hub")
            .task { await session.restore() }
        }.tint(clay)
    }
}
