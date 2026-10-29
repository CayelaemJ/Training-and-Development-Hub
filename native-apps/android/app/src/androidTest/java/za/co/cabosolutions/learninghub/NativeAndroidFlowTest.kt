package za.co.cabosolutions.learninghub

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.performScrollToNode
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
                    close = {},
                    transition = { status, _ -> if (status == "triaged") triageCount++ }
                )
            }
        }

        compose.onNodeWithText("Fractions").assertIsDisplayed()
        compose.onNodeWithText("How do I add unlike fractions?").assertIsDisplayed()
        compose.onNodeWithText("Send reply").assertIsNotEnabled()
        compose.onNodeWithText("Why is this changing?").performScrollTo().performTextInput("Reviewed by the assigned educator.")
        compose.onNodeWithText("Mark as triaged").performScrollTo().assertIsEnabled().performClick()
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
    fun learnerCanRecordWhetherSupportHelped() {
        var feedback = ""
        val ticket = SupportTicket(
            SupportTicketSummary(3, 18, "Fractions", "awaiting_learner", 2, "", reviewAt = "2026-11-02T09:00:00Z"),
            "How do I add unlike fractions?", "I added the denominators.",
            listOf(SupportTicketEvent("reply", "Find a common denominator first.", "Today"))
        )
        compose.setContent {
            MaterialTheme {
                NativeSupportTicketScreen(
                    ticket = ticket,
                    canManageSupport = false,
                    reply = "",
                    onReply = {},
                    triageReason = "",
                    onTriageReason = {},
                    guidance = null,
                    busy = false,
                    message = null,
                    requestGuidance = {},
                    useGuidance = {},
                    sendReply = {},
                    triage = {},
                    assign = {},
                    schedulePractice = { _, _ -> },
                    close = {},
                    isLearnerOwner = true,
                    submitFeedback = { feedback = it }
                )
            }
        }

        compose.onNodeWithText("I understood the help").performScrollTo().performClick()
        assertEquals("helpful", feedback)
    }

    @Test
    fun educatorCanChoosePublishedResultsAndSaveSupportOutcome() {
        var recorded: Triple<Int, Int, String>? = null
        val ticket = SupportTicket(
            SupportTicketSummary(3, 19, "Fractions", "follow_up_required", 4, ""),
            "How do I add unlike fractions?", "I added the denominators.", emptyList(),
            publishedResults = listOf(
                SupportPublishedResult(101, "Baseline checkpoint", 4.0, 10.0, "2026-01-10"),
                SupportPublishedResult(102, "Follow-up checkpoint", 8.0, 10.0, "2026-02-10")
            )
        )
        compose.setContent {
            MaterialTheme {
                NativeSupportTicketScreen(
                    ticket = ticket,
                    canManageSupport = true,
                    reply = "",
                    onReply = {},
                    triageReason = "",
                    onTriageReason = {},
                    guidance = null,
                    busy = false,
                    message = null,
                    requestGuidance = {},
                    useGuidance = {},
                    sendReply = {},
                    triage = {},
                    assign = {},
                    schedulePractice = { _, _ -> },
                    close = {},
                    recordOutcome = { before, after, reason -> recorded = Triple(before, after, reason) }
                )
            }
        }

        compose.onNodeWithText("Initial published result").performScrollTo().performClick()
        compose.onNodeWithText("Baseline checkpoint · 4.0/10.0").performClick()
        compose.onNodeWithText("Follow-up published result").performScrollTo().performClick()
        compose.onNodeWithText("Follow-up checkpoint · 8.0/10.0").performClick()
        compose.onNodeWithText("Why are these results comparable?").performScrollTo()
            .performTextInput("Both assessments cover adding unlike fractions.")
        compose.onNodeWithText("Record comparable evidence").performScrollTo().assertIsEnabled().performClick()

        assertEquals(101, recorded?.first)
        assertEquals(102, recorded?.second)
        assertEquals("Both assessments cover adding unlike fractions.", recorded?.third)
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
class NativeAndroidGuardianReviewTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun schoolGuardianReviewRequiresExplicitEvidenceConfirmation() {
        var decision: Triple<Int, Int, String>? = null
        val data = NativeLearning(
            portal = NativePortal("headmaster", emptyList(), emptyList()),
            materials = emptyList(), quizzes = emptyList(),
            guardianReviewWorkspaces = listOf(GuardianReviewWorkspace(9, listOf(
                GuardianReview(42, "learner-17", "guardian-28", "accepted")
            )))
        )
        compose.setContent {
            MaterialTheme {
                NativeHome(
                    status = "Connected securely to CABO", busy = false, data = data,
                    signIn = {}, refresh = {}, demoEnabled = false, demoActive = false,
                    demoRole = "headmaster", startDemo = {}, setDemoRole = {}, createSupportRequest = {},
                    testLoginAvailable = false, testUsername = "", testPassword = "",
                    onTestUsername = {}, onTestPassword = {}, signInTest = {}, signOut = {},
                    respondToInvite = { _, _ -> },
                    reviewGuardian = { org, relationship, action -> decision = Triple(org, relationship, action) },
                    openSupportTicket = {}, openQuiz = {}, openMaterial = {}, pickMaterial = {}
                )
            }
        }

        compose.onNodeWithText("Support").performClick()
        compose.onNodeWithText("Confirm legal authority using your school's safeguarding process. CABO does not collect or upload identity documents here.")
            .performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Verify guardian access").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag("guardian-evidence-confirmation").performScrollTo().performClick()
        compose.onNodeWithText("Verify guardian access").performScrollTo().assertIsEnabled().performClick()
        assertEquals(Triple(9, 42, "verified"), decision)
    }
}

@RunWith(AndroidJUnit4::class)
class NativeAndroidReportIssuanceTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun schoolReportSubmissionAndReviewActionsEnforceRequiredInputs() {
        var submitted: Triple<Int, String, Int>? = null
        val actions = mutableListOf<Triple<Int, Int, Pair<String, String>>>()
        val data = NativeLearning(
            portal = NativePortal("headmaster", emptyList(), emptyList()),
            materials = emptyList(), quizzes = emptyList(),
            reportIssuanceWorkspaces = listOf(ReportIssuanceWorkspace(9, listOf(
                ReportIssuanceRecord(52, "learner-17", 2026, 1, "submitted", "teacher-1", null, "a".repeat(64), null),
                ReportIssuanceRecord(53, "learner-18", 2025, 2, "issued", "teacher-2", "admin-1", "b".repeat(64), "2026-01-01")
            )))
        )
        compose.setContent {
            MaterialTheme {
                NativeHome(
                    status = "Connected securely to CABO", busy = false, data = data,
                    signIn = {}, refresh = {}, demoEnabled = false, demoActive = false,
                    demoRole = "headmaster", startDemo = {}, setDemoRole = {}, createSupportRequest = {},
                    testLoginAvailable = false, testUsername = "", testPassword = "",
                    onTestUsername = {}, onTestPassword = {}, signInTest = {}, signOut = {},
                    respondToInvite = { _, _ -> }, reviewGuardian = { _, _, _ -> },
                    submitSchoolReport = { organization, learner, year -> submitted = Triple(organization, learner, year) },
                    decideSchoolReport = { organization, report, action, reason ->
                        actions += Triple(organization, report, action to reason)
                    },
                    openSupportTicket = {}, openQuiz = {}, openMaterial = {}, pickMaterial = {}
                )
            }
        }

        compose.onNodeWithText("Support").performClick()
        compose.onNodeWithText("Submit report for review").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText("Enrolled learner account ID").performScrollTo().performTextInput("learner-19")
        compose.onNodeWithText("Submit report for review").performScrollTo().assertIsEnabled().performClick()
        compose.onNodeWithTag("native-role-content").performScrollToNode(hasText("Approve"))
        compose.onNodeWithText("Approve").performScrollTo().performClick()
        compose.onNodeWithTag("native-role-content").performScrollToNode(hasText("Revoke"))
        compose.onNodeWithText("Revoke").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag("report-reason-53").performScrollTo().performTextInput("Duplicate record")
        compose.onNodeWithText("Revoke").performScrollTo().assertIsEnabled().performClick()

        assertEquals(9, submitted?.first)
        assertEquals("learner-19", submitted?.second)
        assertEquals(2026, submitted?.third)
        assertEquals(Triple(9, 52, "approve" to ""), actions[0])
        assertEquals(Triple(9, 53, "revoke" to "Duplicate record"), actions[1])
    }
}

@RunWith(AndroidJUnit4::class)
class NativeAndroidIssuedReportTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun learnerCanReadIssuedSnapshotAndRequestIntegrityVerification() {
        var checkedReport: String? = null
        val report = IssuedSchoolReport(31, 7, 2026, "c".repeat(64), IssuedReportSnapshot(
            "Grade 8", 82.5, listOf(GuardianSubject("Mathematics", 82.5, 4)), 94, 47, 50
        ))
        val data = NativeLearning(
            portal = NativePortal("learner", emptyList(), emptyList()),
            materials = emptyList(), quizzes = emptyList(), issuedReports = listOf(report)
        )
        compose.setContent {
            MaterialTheme {
                NativeHome(
                    status = "Connected securely to CABO", busy = false, data = data,
                    signIn = {}, refresh = {}, demoEnabled = false, demoActive = false,
                    demoRole = "learner", startDemo = {}, setDemoRole = {}, createSupportRequest = {},
                    testLoginAvailable = false, testUsername = "", testPassword = "",
                    onTestUsername = {}, onTestPassword = {}, signInTest = {}, signOut = {},
                    respondToInvite = { _, _ -> }, openSupportTicket = {}, openQuiz = {},
                    openMaterial = {}, pickMaterial = {},
                    verifyIssuedReport = { checkedReport = it.key }
                )
            }
        }
        compose.onNodeWithText("Progress").performClick()
        compose.onNodeWithTag("native-role-content").performScrollToNode(hasText("Published average · 82.5%"))
        compose.onNodeWithText("Published average · 82.5%").assertIsDisplayed()
        compose.onNodeWithText("School-issued pilot record · not a digitally signed or accredited certificate.")
            .performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("native-role-content").performScrollToNode(hasText("Check report integrity"))
        compose.onNodeWithText("Check report integrity").performClick()
        assertEquals("7:31", checkedReport)
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

 
@RunWith(AndroidJUnit4::class)
class NativeAndroidSchoolOperationsTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun learnerCanOpenSchoolNoticesAttendanceAndTimetable() {
        compose.setContent {
            MaterialTheme {
                NativeHome(
                    status = "Connected securely to CABO", busy = false,
                    data = NativeDemoData.learner(), signIn = {}, refresh = {},
                    demoEnabled = true, demoActive = true, demoRole = "learner",
                    startDemo = {}, setDemoRole = {}, createSupportRequest = {},
                    testLoginAvailable = false, testUsername = "", testPassword = "",
                    onTestUsername = {}, onTestPassword = {}, signInTest = {}, signOut = {},
                    respondToInvite = { _, _ -> }, openSupportTicket = {}, openQuiz = {},
                    openMaterial = {}, pickMaterial = {}
                )
            }
        }
        compose.onNodeWithText("School").performClick()
        val content = compose.onNodeWithTag("native-role-content")
        content.performScrollToNode(hasText("Term 2 learning showcase"))
        compose.onNodeWithText("Cabo Valley Learning Centre").assertIsDisplayed()
        content.performScrollToNode(hasText("My attendance"))
        compose.onNodeWithText("My attendance").assertIsDisplayed()
        content.performScrollToNode(hasText("Day 1 · 08:00–08:45 · Mathematics · Form 2 A · Room 4"))
        compose.onNodeWithText("Day 1 · 08:00–08:45 · Mathematics · Form 2 A · Room 4").performScrollTo().assertIsDisplayed()
    }
}


@RunWith(AndroidJUnit4::class)
class NativeAndroidAssessmentWorkspaceTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun teacherCanOpenDemoQuestionBankAndAssessmentPaper() {
        compose.setContent {
            MaterialTheme {
                NativeHome(
                    status = "Demo workspace", busy = false, data = NativeDemoData.teacher(),
                    signIn = {}, refresh = {}, demoEnabled = true, demoActive = true,
                    demoRole = "teacher", startDemo = {}, setDemoRole = {}, createSupportRequest = {},
                    testLoginAvailable = false, testUsername = "", testPassword = "",
                    onTestUsername = {}, onTestPassword = {}, signInTest = {}, signOut = {},
                    respondToInvite = { _, _ -> }, openSupportTicket = {}, openQuiz = {},
                    openMaterial = {}, pickMaterial = {}
                )
            }
        }
        compose.onNodeWithText("Assessments").performClick()
        val content = compose.onNodeWithTag("native-role-content")
        content.performScrollToNode(hasText("Fractions checkpoint"))
        compose.onNodeWithText("Fractions checkpoint").assertExists()
        content.performScrollToNode(hasText("Calculate 3/4 + 1/8 and show your working."))
        compose.onNodeWithText("Calculate 3/4 + 1/8 and show your working.").assertExists()
    }
}

@RunWith(AndroidJUnit4::class)
class NativeAndroidNotificationPreferenceTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun optInRequiresExplicitAcknowledgementAndOptOutIsDirect() {
        val preference = mutableStateOf(NotificationPreferences(true, true, listOf(
            NotificationPreferenceSchool(7, "Cabo Sample School", listOf(
                NotificationPreferenceChoice("guardian_review_requested", false, true)
            ))
        )))
        val changes = mutableListOf<List<Any>>()
        compose.setContent {
            MaterialTheme {
                NotificationPreferencesCard(preference.value, false) { org, kind, enabled, acknowledged ->
                    changes.add(listOf(org, kind, enabled, acknowledged))
                    preference.value = preference.value.copy(schools = preference.value.schools.map { school ->
                        if (school.id != org) school else school.copy(choices = school.choices.map { choice ->
                            if (choice.kind == kind) choice.copy(enabled = enabled) else choice
                        })
                    })
                }
            }
        }

        compose.onNodeWithTag("notification-preference-guardian_review_requested").performClick()
        compose.onNodeWithText("Confirm").assertIsNotEnabled()
        compose.onNodeWithTag("notification-consent-acknowledgement").performClick()
        compose.onNodeWithText("Confirm").assertIsEnabled().performClick()
        compose.waitForIdle()
        assertEquals(listOf(7, "guardian_review_requested", true, true), changes.first())

        compose.onNodeWithTag("notification-preference-guardian_review_requested").performClick()
        compose.waitForIdle()
        assertEquals(listOf(7, "guardian_review_requested", false, false), changes.last())
    }
}


@RunWith(AndroidJUnit4::class)
class NativeAndroidWrittenExamTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun generatesExamRequiresAnswersAndShowsMarkingResult() {
        val exam = WrittenExam(41, "Fractions written check", "beginner",
            listOf(WrittenExamQuestion("Explain how you would add 1/4 and 1/2.", "short_answer", 5)))
        compose.setContent {
            MaterialTheme {
                NativeWrittenExamScreen(
                    materials = listOf(MaterialSummary(9, "Fractions notes")),
                    exams = emptyList(),
                    generate = { materialId, count, difficulty ->
                        assertEquals(9, materialId)
                        assertEquals(5, count)
                        exam.copy(difficulty = difficulty)
                    },
                    open = { exam },
                    submit = { _, answers ->
                        WrittenExamResult(52, 80.0, 4.0, 5.0, 0,
                            listOf(WrittenExamMark(0, 4.0, 5.0, "Good explanation.", false)))
                    },
                    close = {}
                )
            }
        }
        compose.onNodeWithTag("generate-written-exam").performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("submit-written-exam").assertIsNotEnabled()
        compose.onNodeWithTag("written-answer-0").performTextInput("Add the denominators after making them equal.")
        compose.onNodeWithTag("submit-written-exam").assertIsEnabled().performClick()
        compose.waitUntil(timeoutMillis = 10000) {
            compose.onAllNodesWithText("Result · 80.0% (4.0/5.0 marks)").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Result · 80.0% (4.0/5.0 marks)").assertExists()
        compose.onNodeWithText("Good explanation.").assertExists()
    }
}
