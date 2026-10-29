import SwiftUI

struct NativeWrittenExamQuestion: Decodable {
    let prompt: String
    let type: String
    let maxMarks: Int
}
struct NativeWrittenExam: Decodable, Identifiable {
    let id: Int
    let title: String
    let materialId: Int?
    let difficulty: String
    let questions: [NativeWrittenExamQuestion]
}
struct NativeWrittenExamMark: Decodable {
    let questionIndex: Int
    let awardedMarks: Double
    let maxMarks: Double
    let feedback: String
    let needsReview: Bool
}
struct NativeWrittenExamResult: Decodable {
    let id: Int
    let percentage: Double
    let awardedMarks: Double
    let maxMarks: Double
    let reviewRequired: Int
    let feedback: [NativeWrittenExamMark]
}

struct NativeWrittenExamView: View {
    @ObservedObject var session: NativeSession
    @Environment(\.dismiss) private var dismiss
    @State private var materialId: Int?
    @State private var questionCount = 5
    @State private var difficulty = "intermediate"
    @State private var exam: NativeWrittenExam?
    @State private var answers: [String] = []
    @State private var result: NativeWrittenExamResult?
    @State private var busy = false
    @State private var submissionStarted = false
    @State private var message: String?

    private var materials: [NativeMaterialSummary] { session.materialSummaries }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Written exams").font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                Text("Generate a written exam from your own CABO study material, answer each question, and submit your work for marking.")
                    .foregroundColor(.secondary)
                if materials.isEmpty {
                    Label("Add study material before creating an exam.", systemImage: "book")
                        .padding().frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
                } else {
                    Picker("Study material", selection: Binding(
                        get: { materialId ?? materials.first?.id ?? 0 },
                        set: { materialId = $0 }
                    )) {
                        ForEach(materials) { item in Text(item.title).tag(item.id) }
                    }
                    .pickerStyle(.menu)
                    .accessibilityIdentifier("written-exam-material")

                    Stepper("Questions · \(questionCount)", value: $questionCount, in: 1...10)
                    Picker("Difficulty", selection: $difficulty) {
                        Text("Beginner").tag("beginner")
                        Text("Intermediate").tag("intermediate")
                        Text("Advanced").tag("advanced")
                    }
                    .pickerStyle(.segmented)
                    Button {
                        Task { await generate() }
                    } label: {
                        Label("Generate written exam", systemImage: "doc.text.magnifyingglass")
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(busy || session.busy || (materialId ?? materials.first?.id) == nil)
                    .accessibilityIdentifier("generate-written-exam")
                }

                if !session.writtenExams.isEmpty {
                    Text("Your saved exams").font(.title2.bold())
                    ForEach(session.writtenExams) { saved in
                        Button {
                            Task { await load(saved.id) }
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(saved.title).font(.headline)
                                    Text("\(saved.questions.count) questions · \(saved.difficulty.capitalized)")
                                        .font(.subheadline).foregroundColor(.secondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").foregroundColor(.secondary)
                            }
                            .padding(16)
                            .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .disabled(busy)
                    }
                }

                if busy { ProgressView("Working with CABO…").frame(maxWidth: .infinity) }
                if let message { Text(message).font(.subheadline).foregroundColor(.secondary) }

                if let exam {
                    Divider()
                    Text(exam.title).font(.title2.bold())
                    Text("\(exam.questions.reduce(0) { $0 + $1.maxMarks }) marks · \(exam.difficulty.capitalized)")
                        .foregroundColor(.secondary)
                    ForEach(Array(exam.questions.enumerated()), id: \.offset) { index, question in
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Question \(index + 1) · \(question.type.replacingOccurrences(of: "_", with: " ")) · \(question.maxMarks) marks")
                                .font(.subheadline.bold()).foregroundColor(.secondary)
                            Text(question.prompt).font(.headline)
                            TextEditor(text: answerBinding(index))
                                .frame(minHeight: 120)
                                .padding(5)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.secondary.opacity(0.3)))
                                .disabled(busy || submissionStarted)
                                .accessibilityIdentifier("written-answer-\(index)")
                            if let mark = result?.feedback.first(where: { $0.questionIndex == index }) {
                                Text("CABO feedback · \(mark.awardedMarks.formatted())/\(mark.maxMarks.formatted())")
                                    .font(.headline)
                                Text(mark.feedback)
                                if mark.needsReview {
                                    Label("This answer needs educator review.", systemImage: "person.crop.circle.badge.questionmark")
                                        .font(.footnote).foregroundColor(.secondary)
                                }
                            }
                        }
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(UIColor.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
                    }
                    Button {
                        Task { await submitAnswers() }
                    } label: {
                        Text("Submit answers for marking").frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(busy || submissionStarted || answers.count != exam.questions.count || answers.contains { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
                    .accessibilityIdentifier("submit-written-exam")
                    if let result {
                        Text("Result · \(result.percentage.formatted())% (\(result.awardedMarks.formatted())/\(result.maxMarks.formatted()) marks)")
                            .font(.title3.bold())
                        if result.reviewRequired > 0 {
                            Text("\(result.reviewRequired) answer(s) need educator review.")
                        }
                        Text("AI marking supports learning; your educator may review the result.")
                            .font(.footnote).foregroundColor(.secondary)
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .navigationTitle("Written exams")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Done") { dismiss() }.disabled(busy)
            }
        }
    }

    private func answerBinding(_ index: Int) -> Binding<String> {
        Binding(
            get: { answers.indices.contains(index) ? answers[index] : "" },
            set: { value in
                guard !submissionStarted, !busy, answers.indices.contains(index) else { return }
                answers[index] = String(value.prefix(15_000))
            }
        )
    }

    @MainActor private func generate() async {
        guard !busy, let selected = materialId ?? materials.first?.id else { return }
        busy = true; message = nil; result = nil
        defer { busy = false }
        do {
            try await Task.sleep(nanoseconds: 1)
            let created = try await session.generateWrittenExam(
                materialId: selected, questionCount: questionCount, difficulty: difficulty
            )
            select(created)
        } catch {
            message = "CABO could not generate this exam right now. Your material is still saved; try again shortly."
        }
    }

    @MainActor private func load(_ id: Int) async {
        guard !busy else { return }
        busy = true; message = nil
        defer { busy = false }
        do { select(try await session.loadWrittenExam(id: id)) }
        catch { message = "This exam could not be opened. Check your connection and try again." }
    }

    @MainActor private func submitAnswers() async {
        guard let exam, !busy, !submissionStarted,
              answers.count == exam.questions.count,
              !answers.contains(where: { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else {
            message = "Answer every question before submitting."
            return
        }
        submissionStarted = true
        busy = true
        message = nil
        defer { busy = false }
        do { result = try await session.submitWrittenExam(id: exam.id, answers: answers) }
        catch { message = "CABO could not confirm the marking result. Do not submit again yet; check with your educator before retrying." }
    }

    private func select(_ value: NativeWrittenExam) {
        exam = value
        answers = Array(repeating: "", count: value.questions.count)
        result = nil
        submissionStarted = false
        message = nil
    }
}
