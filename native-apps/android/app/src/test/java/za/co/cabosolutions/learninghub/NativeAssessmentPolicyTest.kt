package za.co.cabosolutions.learninghub

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeAssessmentPolicyTest {
    private val optionCounts = listOf(3, 4)

    @Test
    fun allowsACompleteSetOfInRangeAnswers() {
        assertTrue(NativeAssessmentPolicy.canSubmit(optionCounts, listOf(0, 3), busy = false, alreadySubmitted = false))
    }

    @Test
    fun rejectsMissingAnswers() {
        assertFalse(NativeAssessmentPolicy.canSubmit(optionCounts, listOf(1, null), busy = false, alreadySubmitted = false))
    }

    @Test
    fun rejectsOutOfRangeAndNegativeAnswers() {
        assertFalse(NativeAssessmentPolicy.canSubmit(optionCounts, listOf(-1, 1), busy = false, alreadySubmitted = false))
        assertFalse(NativeAssessmentPolicy.canSubmit(optionCounts, listOf(3, 1), busy = false, alreadySubmitted = false))
    }

    @Test
    fun rejectsEmptyOrMismatchedAssessments() {
        assertFalse(NativeAssessmentPolicy.canSubmit(emptyList(), emptyList(), busy = false, alreadySubmitted = false))
        assertFalse(NativeAssessmentPolicy.canSubmit(optionCounts, listOf(1), busy = false, alreadySubmitted = false))
    }

    @Test
    fun preventsConcurrentOrDuplicateSubmission() {
        assertFalse(NativeAssessmentPolicy.canSubmit(optionCounts, listOf(1, 2), busy = true, alreadySubmitted = false))
        assertFalse(NativeAssessmentPolicy.canSubmit(optionCounts, listOf(1, 2), busy = false, alreadySubmitted = true))
    }

    @Test
    fun validatesQuizIdsAndIdempotencyKeys() {
        assertTrue(NativeAssessmentPolicy.isValidQuizId(7))
        assertFalse(NativeAssessmentPolicy.isValidQuizId(0))
        assertTrue(NativeAssessmentPolicy.isValidRequestKey("12345678-1234-4234-8234-123456789abc"))
        assertFalse(NativeAssessmentPolicy.isValidRequestKey("not-a-key"))
    }
}
