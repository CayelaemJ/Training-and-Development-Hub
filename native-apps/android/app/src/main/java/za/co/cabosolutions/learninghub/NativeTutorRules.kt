package za.co.cabosolutions.learninghub

/**
 * Pure rules for the native study tutor. Kept free of Android types so they run as JVM unit tests.
 *
 * The tutor uses the existing server route POST /api/materials/{id}/ask. The server owns the AI
 * provider (Groq by default), checks material ownership, treats the question as untrusted input,
 * retrieves passages from the learner's own material and rejects answers whose citations are not
 * copied from that material. This client never holds a provider key.
 */
internal data class TutorCitation(val excerpt: String)
internal data class TutorAnswer(
    val materialId: Int,
    val materialTitle: String,
    val answer: String,
    val citations: List<TutorCitation>,
    val reviewRequired: Boolean
)
internal data class TutorTurn(val question: String, val answer: TutorAnswer?, val notice: String?)

internal sealed class TutorQuestionCheck {
    data class Ready(val question: String) : TutorQuestionCheck()
    data class Invalid(val message: String) : TutorQuestionCheck()
    /** The learner may be unsafe or need a trusted adult. Do not send to the AI. */
    object NeedsTrustedAdult : TutorQuestionCheck()
}

internal object NativeTutorRules {
    const val MIN_QUESTION = 5
    const val MAX_QUESTION = 2000
    const val MAX_TURNS = 20
    const val MAX_ANSWER = 5000
    const val MAX_CITATIONS = 4

    // A small, deliberately conservative phrase list. It is a safety net for a study tool, not a
    // classifier: a match routes the learner to people who can help instead of to the AI.
    private val trustedAdultPhrases = listOf(
        "kill myself", "end my life", "want to die", "suicide", "hurt myself", "self harm", "self-harm",
        "cutting myself", "someone is hurting me", "abusing me", "abused me", "touched me",
        "not safe at home", "scared to go home", "being bullied", "threatened me"
    )

    fun check(raw: String): TutorQuestionCheck {
        val question = raw.replace(Regex("\\s+"), " ").trim()
        if (question.length < MIN_QUESTION) return TutorQuestionCheck.Invalid("Write a question of at least $MIN_QUESTION characters.")
        if (question.length > MAX_QUESTION) return TutorQuestionCheck.Invalid("Keep your question under $MAX_QUESTION characters.")
        val lower = question.lowercase()
        if (trustedAdultPhrases.any { lower.contains(it) }) return TutorQuestionCheck.NeedsTrustedAdult
        return TutorQuestionCheck.Ready(question)
    }

    /** Validates the server answer before display. Throws on anything unexpected. */
    fun validate(answer: TutorAnswer, requestedMaterialId: Int): TutorAnswer {
        require(answer.materialId == requestedMaterialId) { "Answer was for a different material" }
        require(answer.answer.isNotBlank() && answer.answer.length <= MAX_ANSWER) { "Invalid answer" }
        require(answer.citations.size in 1..MAX_CITATIONS) { "Invalid citations" }
        require(answer.citations.all { it.excerpt.isNotBlank() && it.excerpt.length <= 500 }) { "Invalid citation" }
        return answer
    }

    fun append(turns: List<TutorTurn>, turn: TutorTurn): List<TutorTurn> = (turns + turn).takeLast(MAX_TURNS)

    /** Extracts the HTTP status from NativeApi's "CABO API HTTP nnn" errors. */
    fun statusOf(error: Throwable): Int? =
        Regex("CABO API HTTP (\\d{3})").find(error.message.orEmpty())?.groupValues?.get(1)?.toIntOrNull()

    /** Learner-friendly message. Never echoes server or exception text. */
    fun errorMessage(error: Throwable): String {
        if (error.message == "Session expired") return "Your session ended. Sign in again to keep studying."
        if (error is java.net.SocketTimeoutException) return "The tutor took too long to reply. Check your connection and try again."
        if (error is java.io.IOException) return "You appear to be offline. Your question was not sent."
        return when (statusOf(error)) {
            400 -> "Write a question about this material in your own words."
            404 -> "This material isn't available to your account. Choose one of your own materials."
            413 -> "This material is too large to search at once. Split it into smaller documents."
            422 -> "I couldn't find matching passages in this material. Try a key term from your notes."
            429 -> "The tutor is busy right now. Wait a minute, then try again."
            503 -> "The study tutor isn't switched on for CABO yet. You can still read your material or ask a teacher."
            else -> "I couldn't answer from this material just now. Please try again shortly."
        }
    }

    const val TRUSTED_ADULT_MESSAGE =
        "It sounds like something may be wrong, and you deserve help from a person, not an app. " +
            "Please talk to a parent, teacher or another adult you trust today. " +
            "In South Africa you can call Childline free on 116. If you are in danger right now, call 10111 or 112. " +
            "This message was not sent to the AI tutor."
}
