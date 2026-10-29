package za.co.cabosolutions.learninghub

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
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
        assertEquals(0, compose.onAllNodesWithText("Isolated test account").fetchSemanticsNodes().size)
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
                QuizQuestion("Which fraction is one half?", listOf("Option A: one half", "Option B: one third")),
                QuizQuestion("Which fraction is one quarter?", listOf("Option C: one quarter", "Option D: three quarters"))
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
        compose.onNodeWithText("Option A: one half").performClick()
        compose.onNodeWithText("Option C: one quarter").performClick()
        compose.onNodeWithText("Submit answers").assertIsEnabled().performClick()
        compose.waitForIdle()

        assertEquals(1, submitCount)
        assertEquals(0, compose.onAllNodesWithText("Submit answers").fetchSemanticsNodes().size)
        assertEquals(0, compose.onAllNodesWithText("Your results").fetchSemanticsNodes().size)
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

@RunWith(AndroidJUnit4::class)
class NativeAndroidSupportTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun teacherCanReviewRequestAndReplyOnlyAfterWritingText() {
        val reply = mutableStateOf("")
        var sendCount = 0
        var triageCount = 0
        val summary = SupportTicketSummary(organizationId = 3, id = 18,
            concept = "Fractions", status = "open", version = 1, updatedAt = "")
        val ticket = SupportTicket(summary, "How do I add unlike fractions?",
            "I added the denominators.", listOf(
                SupportTicketEvent("created", "Learner requested educational support", "")
            ))
        compose.setContent {
            MaterialTheme {
                NativeSupportTicketScreen(
                    ticket = ticket,
                    canManageSupport = true,
                    reply = reply.value,
                    onReply = { reply.value = it },
                    triageReason = "Reviewed by the assigned educator.",
                    onTriageReason = {},
                    guidance = null,
                    busy = false,
                    message = null,
                    requestGuidance = {},
                    useGuidance = {},
                    sendReply = { sendCount++ },
                    triage = { triageCount++ },
                    assign = {},
                    schedulePractice = { _, _ -> },
                    close = {}
                )
            }
        }

        compose.onNodeWithText("Fractions").assertIsDisplayed()
        compose.onNodeWithText("How do I add unlike fractions?").assertIsDisplayed()
        compose.onNodeWithText("Send reply").assertIsNotEnabled()
        compose.onNodeWithText("Mark as triaged").assertIsEnabled().performClick()
        compose.onNodeWithText("Write a response").performScrollTo().performTextInput("Find a common denominator first.")
        compose.onNodeWithText("Send reply").performScrollTo().assertIsEnabled().performClick()

        assertEquals(1, triageCount)
        assertEquals(1, sendCount)
    }

    @Test
    fun generatedGuidanceIsClearlyMarkedForReviewAndRequiresExplicitUse() {
        val reply = mutableStateOf("")
        var useCount = 0
        compose.setContent {
            MaterialTheme {
                NativeSupportTicketScreen(
                    ticket = SupportTicket(
                        SupportTicketSummary(3, 18, "Fractions", "triaged", 2, ""),
                        "How do I add unlike fractions?", "I added the denominators.", emptyList()
                    ),
                    canManageSupport = true,
                    reply = reply.value,
                    onReply = { reply.value = it },
                    triageReason = "",
                    onTriageReason = {},
                    guidance = SupportGuidanceDraft(
                        "Find a common denominator before you add the fractions.",
                        listOf("What number appears in both times tables?"),
                        listOf("Try one similar example."), "ai_draft"
                    ),
                    busy = false,
                    message = "Review this draft.",
                    requestGuidance = {},
                    useGuidance = { useCount++ },
                    sendReply = {},
                    triage = {},
                    assign = {},
                    schedulePractice = { _, _ -> },
                    close = {}
                )
            }
        }

        compose.onNodeWithText("Suggested draft · AI, review required").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Review and edit any suggested text before sending.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Add draft to reply").performScrollTo().performClick()
        assertEquals(1, useCount)
    }

    @Test
    fun learnerCanCreateSyntheticDemoSupportRequest() {
        var submitted: List<String>? = null
        compose.setContent {
            MaterialTheme {
                NativeDemoSupportRequestScreen(
                    busy = false,
                    message = null,
                    submit = { concept, question, attempted -> submitted = listOf(concept, question, attempted) },
                    close = {}
                )
            }
        }
        compose.onNodeWithText("Send demo request").assertIsNotEnabled()
        compose.onNodeWithText("What do you need help with?").performScrollTo()
            .performTextInput("How can I add one third and one quarter?")
        compose.onNodeWithText("What have you tried?").performScrollTo()
            .performTextInput("I added the top and bottom numbers.")
        compose.onNodeWithText("Send demo request").performScrollTo().assertIsEnabled().performClick()
        assertEquals("Adding unlike fractions", submitted?.get(0))
        assertEquals("How can I add one third and one quarter?", submitted?.get(1))
        assertEquals("I added the top and bottom numbers.", submitted?.get(2))
    }

    @Test
    fun demoSwitchesRolesAndOpensSyntheticTeacherQueue() {
        val role = mutableStateOf("learner")
        val data = mutableStateOf(NativeDemoData.forRole("learner"))
        var openedTicket: SupportTicketSummary? = null
        compose.setContent {
            MaterialTheme {
                NativeHome(
                    status = "CABO demo · sample data only",
                    busy = false,
                    data = data.value,
                    signIn = {}, refresh = {}, demoEnabled = true, demoActive = true,
                    demoRole = role.value, startDemo = {},
                    setDemoRole = { selected ->
                        role.value = selected
                        data.value = NativeDemoData.forRole(selected)
                    },
                    createSupportRequest = {},
                    testLoginAvailable = false, testUsername = "", testPassword = "",
                    onTestUsername = {}, onTestPassword = {}, signInTest = {}, signOut = {},
                    respondToInvite = { inviteId, accept ->
                        data.value = data.value.copy(guardians = data.value.guardians.map { invite ->
                            if (invite.id == inviteId) invite.copy(status = if (accept) "accepted" else "declined") else invite
                        })
                    },
                    openSupportTicket = { openedTicket = it }, openQuiz = {}, openMaterial = {}, pickMaterial = {}
                )
            }
        }

        compose.onNodeWithText("CABO PREVIEW · sample workspace").assertIsDisplayed()
        compose.onNodeWithText("Learn").performClick()
        assertEquals(0, compose.onAllNodesWithText("Add material from this device").fetchSemanticsNodes().size)
        compose.onNodeWithText("Teacher").performClick()
        compose.onNodeWithText("Support").performClick()
        compose.onNodeWithText("Learner support queue").assertIsDisplayed()
        compose.onNodeWithText("Adding unlike fractions").performScrollTo().performClick()
        assertEquals(73031, openedTicket?.id)

        compose.onNodeWithText("Parent").performClick()
        compose.onNodeWithText("Family").performClick()
        compose.onNodeWithText("Accept invitation").performScrollTo().performClick()
        compose.onNodeWithText("Accepted · school verification pending").assertIsDisplayed()
        compose.onNodeWithText("Progress").performClick()
        compose.onNodeWithText("School-verified progress").assertIsDisplayed()
    }
}

@RunWith(AndroidJUnit4::class)
class NativeAndroidDemoFlowTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun lessonTitlesOpenTheirOwnSampleContent() {
        val fractions = NativeDemoData.materialPage(73011, 0)
        val reading = NativeDemoData.materialPage(73012, 0)
        assertEquals("Fractions made visual", fractions.title)
        assertEquals("Reading with evidence", reading.title)
        org.junit.Assert.assertTrue(reading.text.contains("evidence in the text"))
        org.junit.Assert.assertEquals(1, reading.nextOffset)
        org.junit.Assert.assertTrue(NativeDemoData.materialPage(73012, 1).text.contains("A strong answer"))
    }

    @Test
    fun learnerTeacherSupportHandoffSharesOnlyTheSyntheticDemoRequest() {
        NativeDemoSession.reset()
        NativeDemoSession.createRequest(
            "Equivalent fractions",
            "How can I find a fraction equal to one third?",
            "I multiplied the top and bottom by different numbers."
        )
        val teacherTicket = NativeDemoData.teacher().staff.single().tickets.single()
        assertEquals("Equivalent fractions", teacherTicket.concept)
        val replied = NativeDemoSession.reply(teacherTicket, "Multiply the numerator and denominator by the same number.")
        assertEquals(2, replied.summary.version)
        assertEquals("reply", replied.history.last().kind)
        assertEquals(true, NativeDemoData.learner().learnerHelp.any { it.contains("Educator reply") })
        NativeDemoSession.reset()
    }

    @Test
    fun parentCanSeeExplicitlySyntheticPreviewAndPendingInvitation() {
        val parent = NativeDemoData.parent()
        assertEquals("parent", parent.portal.role)
        assertEquals(false, parent.parentReports.single().official)
        assertEquals("pending", parent.guardians.single { it.id == 73042 }.status)
        assertEquals(true, NativeDemoData.learner().learnerReports.single().average != null)
    }
}

@RunWith(AndroidJUnit4::class)
class NativeAndroidMaterialUploadTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun uploadRequiresATitleAndKeepsOptionalAiReadingOff() {
        val title = mutableStateOf("")
        var uploads = 0
        compose.setContent {
            MaterialTheme {
                NativeMaterialUploadScreen(
                    fileName = "cell-biology.pdf",
                    title = title.value,
                    busy = false,
                    message = null,
                    onTitle = { title.value = it },
                    upload = { uploads++ },
                    close = {}
                )
            }
        }

        compose.onNodeWithText("cell-biology.pdf").assertIsDisplayed()
        compose.onNodeWithText("AI reading stays off. CABO checks the file format before extracting study text.")
            .assertIsDisplayed()
        compose.onNodeWithText("Add to my library").assertIsNotEnabled()
        compose.onNodeWithText("Material title").performTextInput("Cell biology")
        compose.onNodeWithText("Add to my library").assertIsEnabled().performClick()
        assertEquals(1, uploads)
    }
}

@RunWith(AndroidJUnit4::class)
class NativeAndroidSupportDraftTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun learnerCanSaveAndSendAnEnrolledSubjectSupportRequest() {
        var saved: NativeSupportDraft? = null
        var sent: NativeSupportDraft? = null
        compose.setContent {
            MaterialTheme {
                NativeSupportDraftScreen(
                    courses = listOf(SupportCourseOption(3, 8, "Mathematics")),
                    initial = null, busy = false, message = null,
                    save = { saved = it }, submit = { sent = it }, close = {}
                )
            }
        }
        compose.onNodeWithText("Save securely on this device").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText("Topic").performTextInput("Fractions")
        compose.onNodeWithText("What do you need help with?").performScrollTo()
            .performTextInput("How do I add unlike fractions?")
        compose.onNodeWithText("What have you tried?").performScrollTo()
            .performTextInput("I added the denominators.")
        compose.onNodeWithText("Save securely on this device").performScrollTo().assertIsEnabled().performClick()
        compose.onNodeWithText("Send to my educator").performScrollTo().performClick()
        assertEquals(3, saved?.organizationId)
        assertEquals(8, sent?.courseId)
        assertEquals(saved?.requestKey, sent?.requestKey)
        assertEquals("How do I add unlike fractions?", sent?.question)
    }
}
