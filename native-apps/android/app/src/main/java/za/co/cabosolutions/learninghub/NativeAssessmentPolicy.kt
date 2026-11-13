package za.co.cabosolutions.learninghub

/**
 * Local guardrails for quiz submissions. Server-side validation remains authoritative.
 */
internal object NativeAssessmentPolicy {
    fun canSubmit(
        questionOptionCounts: List<Int>,
        answers: List<Int?>,
        busy: Boolean,
        alreadySubmitted: Boolean
    ): Boolean {
        if (busy || alreadySubmitted || questionOptionCounts.isEmpty() ||
            answers.size != questionOptionCounts.size) return false
        return questionOptionCounts.indices.all { index ->
            val optionCount = questionOptionCounts[index]
            val answer = answers[index]
            optionCount > 0 && answer != null && answer in 0 until optionCount
        }
    }

    fun isValidQuizId(id: Int): Boolean = id > 0

    fun isValidRequestKey(value: String): Boolean =
        value.matches(Regex("[A-Za-z0-9_-]{16,64}"))
}
