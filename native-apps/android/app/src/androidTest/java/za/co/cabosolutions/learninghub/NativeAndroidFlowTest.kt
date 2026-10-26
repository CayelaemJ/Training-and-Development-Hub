package za.co.cabosolutions.learninghub

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertDoesNotExist
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeAndroidHomeTest {
    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    @Test
    fun defaultBuildShowsSecureSignInAndHidesTestCredentials() {
        compose.onNodeWithText("CABO").assertIsDisplayed()
        compose.onNodeWithText("Sign in securely").assertIsDisplayed()
        compose.onNodeWithText("Isolated test account").assertDoesNotExist()
    }
}

@RunWith(AndroidJUnit4::class)
class NativeAndroidQuizTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun answersAreRequiredAndSubmissionIsOneShot() {
        val answers = mutableStateOf<List<Int?>>(listOf(null, null))
        val submitted = mutableStateOf(false)
        var submitCount = 0
        val quiz = PracticeQuiz(
            id = 27,
            title = "Fractions",
            questions = listOf(
                QuizQuestion("Which fraction is one half?", listOf("1/2", "1/3")),
                QuizQuestion("Which fraction is one quarter?", listOf("1/4", "1/2"))
            )
        )
        compose.setContent {
            MaterialTheme {
                NativeQuizScreen(
                    summary = QuizSummary(27, "Fractions", 2, null),
                    quiz = quiz,
                    answers = answers.value,
                    attempt = null,
                    busy = false,
                    submitted = submitted.value,
                    message = null,
                    uncertain = false,
                    recover = {},
                    answer = { question, option ->
                        answers.value = answers.value.toMutableList().also { it[question] = option }
                    },
                    submit = { submitCount++; submitted.value = true },
                    close = {}
                )
            }
        }

        compose.onNodeWithText("Submit answers").assertIsNotEnabled()
        compose.onNodeWithText("1/2").performClick()
        compose.onNodeWithText("1/4").performClick()
        compose.onNodeWithText("Submit answers").assertIsEnabled().performClick()
        compose.waitForIdle()

        assertEquals(1, submitCount)
        compose.onNodeWithText("Submit answers").assertDoesNotExist()
        compose.onNodeWithText("Your results").assertDoesNotExist()
        compose.onNodeWithText("Practice results come from CABO, not this device.").assertIsDisplayed()
    }

    @Test
    fun uncertainSubmissionOffersStatusLookup() {
        var recoveryCount = 0
        compose.setContent {
            MaterialTheme {
                NativeQuizScreen(
                    summary = QuizSummary(27, "Fractions", 2, null),
                    quiz = null,
                    answers = emptyList(),
                    attempt = null,
                    busy = false,
                    submitted = true,
                    message = "Submission status uncertain.",
                    uncertain = true,
                    recover = { recoveryCount++ },
                    answer = { _, _ -> },
                    submit = {},
                    close = {}
                )
            }
        }

        compose.onNodeWithText("Submission status uncertain.").assertIsDisplayed()
        compose.onNodeWithText("Check submission status").performClick()
        assertEquals(1, recoveryCount)
    }
}
