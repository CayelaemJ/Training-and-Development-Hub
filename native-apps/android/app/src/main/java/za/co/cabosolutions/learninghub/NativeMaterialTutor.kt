package za.co.cabosolutions.learninghub

import org.json.JSONObject
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.UUID

// Contract for the existing grounded tutor endpoint:
// POST /api/materials/:id/ask  {question}
//   -> {materialId, materialTitle, answer, citations:[{excerpt}], modelId, reviewRequired}
// The server only answers for materials owned by the signed-in account,
// retrieves passages from that material, treats the question as untrusted,
// rejects citations that are not copied from the material, and applies the
// shared AI rate limit. The app holds no AI provider key and makes no direct
// provider calls. Same rules as the iOS client (NativeMaterialTutor.swift).

internal data class MaterialCitation(val excerpt: String)

internal data class MaterialAnswer(
    val materialId: Int,
    val materialTitle: String,
    val answer: String,
    val citations: List<MaterialCitation>,
    val reviewRequired: Boolean
)

internal data class TutorExchange(
    val id: String,
    val question: String,
    val answer: MaterialAnswer
)

internal class TutorResponseException : IllegalStateException("Tutor reply failed validation")
internal class TutorAccountChangedException : IllegalStateException("Account changed during tutor request")

internal object NativeMaterialTutor {
    val QUESTION_LIMITS = 5..2000
    const val ANSWER_LIMIT = 5000
    val CITATION_LIMITS = 20..500
    const val MAX_CITATIONS = 4
    /** In-memory exchanges kept per material while signed in. Never persisted. */
    const val HISTORY_LIMIT = 10

    const val GUIDANCE = "Answers use only passages from this material. They can still be incomplete or wrong, so check important points with your notes or your teacher. Do not include personal details in your question."

    /** Trims the question and enforces the same bounds as the server. */
    fun validatedQuestion(raw: String): String? {
        val clean = raw.trim()
        return if (clean.length in QUESTION_LIMITS) clean else null
    }

    /** Rejects anything outside the published contract, including an answer for another material. */
    fun parseAnswer(json: JSONObject, expectedMaterialId: Int): MaterialAnswer {
        val materialId = json.optInt("materialId", -1)
        val answer = json.optString("answer", "").trim()
        val rows = json.optJSONArray("citations") ?: throw TutorResponseException()
        val citations = (0 until rows.length()).map { index ->
            val excerpt = rows.optJSONObject(index)?.optString("excerpt", "")?.trim().orEmpty()
            MaterialCitation(excerpt)
        }
        if (materialId != expectedMaterialId || answer.isEmpty() || answer.length > ANSWER_LIMIT ||
            citations.size !in 1..MAX_CITATIONS || citations.any { it.excerpt.length !in CITATION_LIMITS }) {
            throw TutorResponseException()
        }
        return MaterialAnswer(
            materialId = materialId,
            materialTitle = json.optString("materialTitle", "").take(200),
            answer = answer,
            citations = citations,
            // Always treat tutor output as needing review, whatever the flag says.
            reviewRequired = true
        )
    }

    fun exchange(question: String, answer: MaterialAnswer) =
        TutorExchange(UUID.randomUUID().toString(), question, answer)

    /** Appends an exchange and keeps only the most recent HISTORY_LIMIT. */
    fun appending(exchange: TutorExchange, history: List<TutorExchange>): List<TutorExchange> =
        (history + exchange).takeLast(HISTORY_LIMIT)

    /** HTTP status from NativeApi's "CABO API HTTP <code>" errors, if present. */
    fun httpStatus(error: Throwable): Int? =
        Regex("""CABO API HTTP (\d{3})""").find(error.message.orEmpty())?.groupValues?.get(1)?.toIntOrNull()

    /** Learner-facing message. Server or exception text is never shown directly. */
    fun message(error: Throwable): String = when {
        error is TutorResponseException ->
            "The tutor reply could not be checked, so it was not shown. Please try again."
        error is TutorAccountChangedException ->
            "Your account changed while the tutor was answering. Ask again."
        error is IllegalArgumentException ->
            "Ask a question between 5 and 2,000 characters."
        error is SocketTimeoutException ->
            "The tutor took too long to answer. Check your connection and try again."
        error is UnknownHostException || error is ConnectException ->
            "You appear to be offline. Connect to the internet to ask the tutor."
        error.message == "Session expired" || error.message == "Sign in required" ->
            "Your session expired. Sign in again to use the tutor."
        else -> when (httpStatus(error)) {
            400 -> "Ask a question between 5 and 2,000 characters."
            403, 404 -> "This material is not available to your account."
            413 -> "This material is too large for the tutor. Split it into smaller documents."
            422 -> "No matching passages were found. Try a key term from your notes."
            429 -> "You have asked many questions recently. Wait a few minutes and try again."
            503 -> "The tutor is not available right now. Your material is still saved."
            null -> "Could not reach CABO. Check your connection and try again."
            else -> "The tutor couldn’t answer just now. Please try again shortly."
        }
    }
}
