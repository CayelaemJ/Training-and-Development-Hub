import Foundation

// Contract for the existing grounded tutor endpoint:
// POST /api/materials/:id/ask  {question}
//   -> {materialId, materialTitle, answer, citations:[{excerpt}], modelId, reviewRequired}
// The server only answers for materials owned by the signed-in account,
// retrieves passages from that material, treats the question as untrusted,
// rejects citations that are not copied from the material, and applies the
// shared AI rate limit. The app adds no AI provider keys and makes no direct
// provider calls.

struct NativeMaterialCitation: Decodable, Hashable {
    let excerpt: String
}

struct NativeMaterialAnswer: Decodable {
    let materialId: Int
    let materialTitle: String
    let answer: String
    let citations: [NativeMaterialCitation]
    let reviewRequired: Bool
}

struct NativeTutorExchange: Identifiable {
    let id: UUID
    let question: String
    let answer: NativeMaterialAnswer
}

enum NativeTutorError: Error, Equatable {
    case invalidQuestion
    case invalidResponse
    case accountChanged
}

enum NativeMaterialTutor {
    static let questionLimits = 5...2000
    static let answerLimit = 5000
    static let citationLimits = 20...500
    static let maxCitations = 4
    /// In-memory exchanges kept per material while signed in. Never persisted.
    static let historyLimit = 10

    static let guidance = "Answers use only passages from this material. They can still be incomplete or wrong, so check important points with your notes or your teacher. Do not include personal details in your question."

    /// Trims the question and enforces the same bounds as the server.
    static func validatedQuestion(_ raw: String) -> String? {
        let clean = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard questionLimits.contains(clean.count) else { return nil }
        return clean
    }

    /// Decodes the server reply and rejects anything outside the published
    /// contract, including an answer for a different material.
    static func decodeAnswer(_ data: Data, expectedMaterialId: Int) throws -> NativeMaterialAnswer {
        guard let decoded = try? JSONDecoder().decode(NativeMaterialAnswer.self, from: data) else {
            throw NativeTutorError.invalidResponse
        }
        let answer = decoded.answer.trimmingCharacters(in: .whitespacesAndNewlines)
        let citations = decoded.citations
            .map { NativeMaterialCitation(excerpt: $0.excerpt.trimmingCharacters(in: .whitespacesAndNewlines)) }
        guard decoded.materialId == expectedMaterialId,
              !answer.isEmpty, answer.count <= answerLimit,
              (1...maxCitations).contains(citations.count),
              citations.allSatisfy({ citationLimits.contains($0.excerpt.count) }) else {
            throw NativeTutorError.invalidResponse
        }
        return NativeMaterialAnswer(
            materialId: decoded.materialId,
            materialTitle: String(decoded.materialTitle.prefix(200)),
            answer: answer,
            citations: citations,
            // Always treat tutor output as needing review, whatever the flag says.
            reviewRequired: true
        )
    }

    /// Appends an exchange and keeps only the most recent `historyLimit`.
    static func appending(_ exchange: NativeTutorExchange, to history: [NativeTutorExchange]) -> [NativeTutorExchange] {
        Array((history + [exchange]).suffix(historyLimit))
    }

    /// Learner-facing message for a failed request. Server error text is not
    /// shown directly so unexpected internal detail is never displayed.
    static func message(for error: Error) -> String {
        if let tutorError = error as? NativeTutorError {
            switch tutorError {
            case .invalidQuestion:
                return "Ask a question between 5 and 2,000 characters."
            case .invalidResponse:
                return "The tutor reply could not be checked, so it was not shown. Please try again."
            case .accountChanged:
                return "Your account changed while the tutor was answering. Ask again."
            }
        }
        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut:
                return "The tutor took too long to answer. Check your connection and try again."
            case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed:
                return "You appear to be offline. Connect to the internet to ask the tutor."
            case .cancelled:
                return "The question was cancelled."
            default:
                return "Could not reach CABO. Check your connection and try again."
            }
        }
        let nsError = error as NSError
        guard nsError.domain == "CABO" else {
            return "Could not reach CABO. Check your connection and try again."
        }
        switch nsError.code {
        case 400: return "Ask a question between 5 and 2,000 characters."
        case 401: return "Your session expired. Sign in again to use the tutor."
        case 403, 404: return "This material is not available to your account."
        case 413: return "This material is too large for the tutor. Split it into smaller documents."
        case 422: return "No matching passages were found. Try a key term from your notes."
        case 429: return "You have asked many questions recently. Wait a few minutes and try again."
        case 503: return "The tutor is not available right now. Your material is still saved."
        default: return "The tutor couldn’t answer just now. Please try again shortly."
        }
    }
}
