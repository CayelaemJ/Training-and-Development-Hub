package za.co.cabosolutions.learninghub

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.net.SocketTimeoutException

class NativeTutorRulesTest {
    private fun answer(materialId: Int = 9, text: String = "Fractions describe equal parts.",
                       citations: List<TutorCitation> = listOf(TutorCitation("A fraction names equal parts of one whole.")))
        = TutorAnswer(materialId, "Fractions notes", text, citations, true)

    @Test fun shortQuestionIsRejectedBeforeAnyRequest() {
        assertTrue(NativeTutorRules.check("why") is TutorQuestionCheck.Invalid)
        assertTrue(NativeTutorRules.check("      ") is TutorQuestionCheck.Invalid)
    }

    @Test fun overlongQuestionIsRejected() {
        assertTrue(NativeTutorRules.check("a".repeat(NativeTutorRules.MAX_QUESTION + 1)) is TutorQuestionCheck.Invalid)
    }

    @Test fun whitespaceIsCollapsedAndValidQuestionIsReady() {
        val check = NativeTutorRules.check("  What   is a\n fraction? ")
        assertEquals(TutorQuestionCheck.Ready("What is a fraction?"), check)
    }

    @Test fun safeguardingPhrasesAreNeverSentToTheAi() {
        listOf("I want to die", "Someone is HURTING ME at home", "how do I stop self-harm").forEach {
            assertEquals(it, TutorQuestionCheck.NeedsTrustedAdult, NativeTutorRules.check(it))
        }
    }

    @Test fun ordinaryStudyQuestionsAreNotFlagged() {
        listOf("How did the war end in chapter 3?", "Explain cell division", "What killed the dinosaurs?").forEach {
            assertTrue(it, NativeTutorRules.check(it) is TutorQuestionCheck.Ready)
        }
    }

    @Test fun answerForAnotherMaterialIsRejected() {
        val result = runCatching { NativeTutorRules.validate(answer(materialId = 10), 9) }
        assertTrue(result.isFailure)
    }

    @Test fun answerWithoutCitationIsRejected() {
        assertTrue(runCatching { NativeTutorRules.validate(answer(citations = emptyList()), 9) }.isFailure)
    }

    @Test fun answerWithTooManyCitationsIsRejected() {
        val many = List(NativeTutorRules.MAX_CITATIONS + 1) { TutorCitation("Excerpt number $it from the material.") }
        assertTrue(runCatching { NativeTutorRules.validate(answer(citations = many), 9) }.isFailure)
    }

    @Test fun validAnswerPasses() {
        assertEquals(answer(), NativeTutorRules.validate(answer(), 9))
    }

    @Test fun historyIsBounded() {
        var turns = emptyList<TutorTurn>()
        repeat(NativeTutorRules.MAX_TURNS + 5) { turns = NativeTutorRules.append(turns, TutorTurn("Question $it", null, "x")) }
        assertEquals(NativeTutorRules.MAX_TURNS, turns.size)
        assertEquals("Question 5", turns.first().question)
    }

    @Test fun httpStatusIsParsedFromApiErrors() {
        assertEquals(429, NativeTutorRules.statusOf(IllegalStateException("CABO API HTTP 429")))
        assertNull(NativeTutorRules.statusOf(IllegalStateException("something else")))
    }

    @Test fun errorMessagesAreFriendlyAndNeverEchoServerText() {
        val secretish = IllegalStateException("CABO API HTTP 500 internal stack at db.query(SELECT ...)")
        val message = NativeTutorRules.errorMessage(secretish)
        assertFalse(message.contains("SELECT"))
        assertTrue(NativeTutorRules.errorMessage(IllegalStateException("CABO API HTTP 503")).contains("isn't switched on"))
        assertTrue(NativeTutorRules.errorMessage(IllegalStateException("CABO API HTTP 404")).contains("isn't available"))
        assertTrue(NativeTutorRules.errorMessage(SocketTimeoutException()).contains("too long"))
        assertTrue(NativeTutorRules.errorMessage(IOException()).contains("offline"))
        assertTrue(NativeTutorRules.errorMessage(IllegalStateException("Session expired")).contains("Sign in again"))
    }
}
