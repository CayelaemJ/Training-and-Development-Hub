import SwiftUI

// All questions and results come from the learner-scoped CABO backend.
// No answer keys are returned until the backend has graded a submitted attempt.
struct NativeQuizSummary: Decodable, Identifiable {
    let id: Int
    let title: String
    let questionCount: Int
    let latestScore: Double?
}

struct NativeQuizQuestion: Decodable {
    let prompt: String
    let options: [String]
}

struct NativePracticeQuiz: Decodable {
    let id: Int
    let title: String
    let questions: [NativeQuizQuestion]
}

struct NativeQuizFeedback: Decodable {
    let questionIndex: Int
    let selectedOption: Int
    let correctOption: Int
    let explanation: String
    let isCorrect: Bool
}

struct NativeQuizAttempt: Decodable {
    let id: Int
    let quizId: Int
    let correctCount: Int
    let totalQuestions: Int
    let percentage: Double
    let feedback: [NativeQuizFeedback]
}

struct NativeQuizView: View {
    @ObservedObject var session: NativeSession
    let item: NativeQuizSummary
    @Environment(\.dismiss) private var dismiss

    @State private var quiz: NativePracticeQuiz?
    @State private var answers: [Int?] = []
    @State private var attempt: NativeQuizAttempt?
    @State private var busy = false
    @State private var submissionStarted = false
    @State private var message: String?

    private var complete: Bool {
        guard let quiz else { return false }
        return !quiz.questions.isEmpty && answers.count == quiz.questions.count &&
            answers.allSatisfy { $0 != nil }
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(item.title).font(.title2.bold())
                        .accessibilityAddTraits(.isHeader)
                    Text("Practice assessment · Answers are checked securely by CABO.")
                        .font(.subheadline).foregroundColor(.secondary)

                    if busy { ProgressView("Communicating with CABO…") }
                    if let message {
                        Text(message).foregroundColor(.secondary)
                            .accessibilityAddTraits(.updatesFrequently)
                    }

                    if let quiz {
                        ForEach(quiz.questions.indices, id: \.self) { index in
                            let question = quiz.questions[index]
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Question \(index + 1) of \(quiz.questions.count)")
                                    .font(.caption).foregroundColor(.secondary)
                                Text(question.prompt).font(.headline)
                                ForEach(question.options.indices, id: \.self) { optionIndex in
                                    Button {
                                        guard !submissionStarted else { return }
                                        answers[index] = optionIndex
                                    } label: {
                                        HStack(spacing: 12) {
                                            Image(systemName: answers[index] == optionIndex
                                                  ? "largecircle.fill.circle" : "circle")
                                            Text(question.options[optionIndex])
                                                .multilineTextAlignment(.leading)
                                            Spacer(minLength: 0)
                                        }
                                        .padding(12)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(Color(UIColor.secondarySystemBackground),
                                                    in: RoundedRectangle(cornerRadius: 10))
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("Question \(index + 1), option \(optionIndex + 1): \(question.options[optionIndex])")
                                    .accessibilityAddTraits(answers[index] == optionIndex ? .isSelected : [])
                                    .disabled(submissionStarted)
                                }
                            }
                            .padding(.vertical, 10)
                            Divider()
                        }

                        if !submissionStarted {
                            Button("Submit answers") { Task { await submit() } }
                                .buttonStyle(.borderedProminent)
                                .controlSize(.large)
                                .disabled(!complete || busy)
                            Text("Submit only when ready. An interrupted submission must be checked on the web before another attempt.")
                                .font(.footnote).foregroundColor(.secondary)
                        }
                    }

                    if let attempt {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Your results").font(.title2.bold())
                            Text("\(attempt.correctCount) of \(attempt.totalQuestions) correct · \(attempt.percentage.formatted())%")
                                .font(.headline)
                            Text("Automated practice feedback is not a human-verified qualification.")
                                .font(.footnote).foregroundColor(.secondary)
                            ForEach(attempt.feedback, id: \.questionIndex) { feedback in
                                VStack(alignment: .leading, spacing: 6) {
                                    Label("Question \(feedback.questionIndex + 1)",
                                          systemImage: feedback.isCorrect ? "checkmark.circle" : "xmark.circle")
                                        .font(.headline)
                                    Text(feedback.explanation).font(.body)
                                }
                                .padding(.vertical, 6)
                            }
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(UIColor.secondarySystemBackground),
                                    in: RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding()
                .frame(maxWidth: 720, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("Practice test")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") { dismiss() }.disabled(busy)
                }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .task { await load() }
    }

    private func load() async {
        guard !busy, quiz == nil else { return }
        busy = true
        defer { busy = false }
        do {
            let loaded = try await session.loadQuiz(id: item.id)
            guard loaded.id == item.id, !loaded.questions.isEmpty,
                  loaded.questions.allSatisfy({ !$0.options.isEmpty }) else {
                message = "CABO returned an incomplete assessment. Nothing was submitted."
                return
            }
            quiz = loaded
            answers = Array(repeating: nil, count: loaded.questions.count)
        } catch {
            message = "The assessment could not be loaded. Check your connection and reopen it."
        }
    }

    private func submit() async {
        guard !busy, !submissionStarted, complete, let quiz else { return }
        // Keep this flag set even after a timeout. We cannot know whether
        // an interrupted request reached the server; blind retry can double-post.
        submissionStarted = true
        busy = true
        defer { busy = false }
        do {
            let submitted = try await session.submitQuiz(
                id: quiz.id, answers: answers.compactMap { $0 })
            guard submitted.quizId == quiz.id,
                  submitted.totalQuestions == quiz.questions.count else {
                message = "CABO returned an unexpected result. Check your assessment history."
                return
            }
            attempt = submitted
            message = "Answers submitted and graded by CABO."
        } catch {
            message = "Submission status could not be confirmed. Do not submit again yet. Check your CABO web assessment history first."
        }
    }
}
