package za.co.cabosolutions.learninghub

import androidx.activity.ComponentActivity
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.net.SocketTimeoutException
import java.net.UnknownHostException

private const val EXCERPT = "Photosynthesis converts light energy into chemical energy in plants."

private fun tutorReply(
    materialId: Int = 7,
    answer: String = "Plants use light to make glucose, as the notes explain.",
    citations: List<String> = listOf(EXCERPT),
    reviewRequired: Boolean = true
): JSONObject = JSONObject()
    .put("materialId", materialId)
    .put("materialTitle", "Biology notes")
    .put("answer", answer)
    .put("citations", JSONArray(citations.map { JSONObject().put("excerpt", it) }))
    .put("modelId", "test-model")
    .put("reviewRequired", reviewRequired)

@RunWith(AndroidJUnit4::class)
class NativeMaterialTutorContractTest {
    @Test
    fun questionIsTrimmedAndBoundedLikeTheServer() {
        assertEquals("What is osmosis?", NativeMaterialTutor.validatedQuestion("  What is osmosis?  \n"))
        assertNull(NativeMaterialTutor.validatedQuestion("   why "))
        assertNull(NativeMaterialTutor.validatedQuestion("a".repeat(2001)))
        assertNotNull(NativeMaterialTutor.validatedQuestion("a".repeat(2000)))
    }

    @Test
    fun validGroundedAnswerParsesAndIsAlwaysMarkedForReview() {
        val answer = NativeMaterialTutor.parseAnswer(tutorReply(reviewRequired = false), 7)
        assertEquals(7, answer.materialId)
        assertEquals(listOf(EXCERPT), answer.citations.map { it.excerpt })
        assertTrue(answer.reviewRequired)
    }

    @Test
    fun answerForAnotherMaterialOrWithoutValidCitationsIsRejected() {
        val bad = listOf(
            tutorReply(materialId = 8),
            tutorReply(citations = emptyList()),
            tutorReply(citations = List(5) { EXCERPT }),
            tutorReply(citations = listOf("too short")),
            tutorReply(answer = "   "),
            tutorReply(answer = "x".repeat(5001)),
            JSONObject().put("error", "nope")
        )
        bad.forEach { json ->
            try {
                NativeMaterialTutor.parseAnswer(json, 7)
                fail("Expected rejection for $json")
            } catch (_: TutorResponseException) { }
        }
    }

    @Test
    fun historyKeepsOnlyRecentExchanges() {
        val answer = NativeMaterialTutor.parseAnswer(tutorReply(), 7)
        var history = emptyList<TutorExchange>()
        repeat(15) { history = NativeMaterialTutor.appending(NativeMaterialTutor.exchange("Question $it", answer), history) }
        assertEquals(NativeMaterialTutor.HISTORY_LIMIT, history.size)
        assertEquals("Question 5", history.first().question)
        assertEquals("Question 14", history.last().question)
    }

    @Test
    fun failuresMapToSafeLearnerMessages() {
        assertTrue(NativeMaterialTutor.message(IllegalStateException("CABO API HTTP 429")).contains("Wait"))
        assertTrue(NativeMaterialTutor.message(IllegalStateException("CABO API HTTP 503")).contains("not available"))
        assertTrue(NativeMaterialTutor.message(IllegalStateException("CABO API HTTP 404")).contains("not available to your account"))
        assertTrue(NativeMaterialTutor.message(IllegalStateException("Session expired")).contains("Sign in again"))
        assertTrue(NativeMaterialTutor.message(SocketTimeoutException()).contains("too long"))
        assertTrue(NativeMaterialTutor.message(UnknownHostException()).contains("offline"))
        assertTrue(NativeMaterialTutor.message(TutorAccountChangedException()).contains("account changed"))
        // Unknown errors never echo internal detail.
        assertTrue(!NativeMaterialTutor.message(RuntimeException("db host 10.0.0.1")).contains("10.0.0.1"))
    }
}

@RunWith(AndroidJUnit4::class)
class NativeMaterialTutorScreenTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val material = MaterialSummary(7, "Biology notes")

    @Test
    fun demoOrSignedOutTutorExplainsWhyAndOffersNoAskButton() {
        compose.setContent {
            MaterialTheme {
                NativeMaterialScreen(material, "Sample text", null, false, null, {}, {},
                    tutor = MaterialTutorState(available = false,
                        unavailableReason = "The tutor needs a connected CABO account."))
            }
        }
        compose.onNodeWithText("Ask about this material").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("The tutor needs a connected CABO account.").performScrollTo().assertIsDisplayed()
        assertEquals(0, compose.onAllNodesWithText("Ask the tutor").fetchSemanticsNodes().size)
    }

    @Test
    fun askIsDisabledUntilQuestionIsLongEnough() {
        compose.setContent {
            MaterialTheme {
                NativeMaterialScreen(material, "Sample text", null, false, null, {}, {},
                    tutor = MaterialTutorState(available = true, question = "why"))
            }
        }
        compose.onNodeWithText("Ask the tutor").performScrollTo().assertIsNotEnabled()
    }

    @Test
    fun answerShowsQuotedPassagesAndReviewNotice() {
        val answer = NativeMaterialTutor.parseAnswer(tutorReply(), 7)
        compose.setContent {
            MaterialTheme {
                NativeMaterialScreen(material, "Sample text", null, false, null, {}, {},
                    tutor = MaterialTutorState(available = true, question = "What is photosynthesis?",
                        history = listOf(NativeMaterialTutor.exchange("What is photosynthesis?", answer))))
            }
        }
        compose.onNodeWithText("Ask the tutor").performScrollTo().assertIsEnabled()
        compose.onNodeWithText("“$EXCERPT”").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Check this answer against your notes. AI answers can be wrong.")
            .performScrollTo().assertIsDisplayed()
    }
}
