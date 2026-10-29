package za.co.cabosolutions.learninghub

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.School
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.input.PasswordVisualTransformation
import kotlinx.coroutines.launch

// Jetpack Compose native screen; no WebView or embedded web application.
// Learner resources come from CABO's permission-filtered existing endpoints.
class MainActivity : ComponentActivity() {
    private val api by lazy { NativeApi(this) }
    private var demoActive by mutableStateOf(false)
    private var demoRole by mutableStateOf("learner")
    private var status by mutableStateOf("CABO native Android preview")
    private var testUsername by mutableStateOf("cabo_test")
    private var testPassword by mutableStateOf("")
    private var busy by mutableStateOf(false)
    private var screen by mutableStateOf<NativeLearning?>(null)
    private var creatingSupportRequest by mutableStateOf(false)
    private var selectedSupportTicket by mutableStateOf<SupportTicketSummary?>(null)
    private var supportTicket by mutableStateOf<SupportTicket?>(null)
    private var supportReply by mutableStateOf("")
    private var supportTriageReason by mutableStateOf("Reviewed by the assigned educator.")
    private var supportGuidance by mutableStateOf<SupportGuidanceDraft?>(null)
    private var supportBusy by mutableStateOf(false)
    private var supportMessage by mutableStateOf<String?>(null)
    private var selectedQuiz by mutableStateOf<QuizSummary?>(null)
    private var selectedWrittenExams by mutableStateOf(false)
    private var selectedLearnerPassport by mutableStateOf(false)
    private var learnerPassport by mutableStateOf<LearnerPassport?>(null)
    private var learnerPassportBusy by mutableStateOf(false)
    private var learnerPassportMessage by mutableStateOf<String?>(null)
    private var managerCreatingExam by mutableStateOf(false)
    private var selectedMaterial by mutableStateOf<MaterialSummary?>(null)
    private var selectedUploadUri by mutableStateOf<Uri?>(null)
    private var selectedUploadFileName by mutableStateOf("")
    private var selectedUploadTitle by mutableStateOf("")
    private var materialUploadBusy by mutableStateOf(false)
    private var materialUploadMessage by mutableStateOf<String?>(null)
    private var supportDrafts by mutableStateOf<List<NativeSupportDraft>>(emptyList())
    private var supportCourseOptions by mutableStateOf<List<SupportCourseOption>>(emptyList())
    private var selectedSupportDraft by mutableStateOf<NativeSupportDraft?>(null)
    private var supportFormBusy by mutableStateOf(false)
    private var supportFormMessage by mutableStateOf<String?>(null)
    private var activeQuiz by mutableStateOf<PracticeQuiz?>(null)
    private var answers by mutableStateOf<List<Int?>>(emptyList())
    private var attempt by mutableStateOf<QuizAttempt?>(null)
    private var studyText by mutableStateOf("")
    private var nextPage by mutableStateOf<Int?>(null)
    private var studyBusy by mutableStateOf(false)
    private var studySubmitted by mutableStateOf(false)
    private var studyUnconfirmed by mutableStateOf(false)
    private var submissionKey by mutableStateOf("")
    private var studyMessage by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val materialPicker = rememberLauncherForActivityResult(
                ActivityResultContracts.OpenDocument()
            ) { uri ->
                if (uri != null && !materialUploadBusy) {
                    selectedUploadUri = uri
                    selectedUploadFileName = "Selected document"
                    selectedUploadTitle = ""
                    materialUploadMessage = null
                    lifecycleScope.launch {
                        try {
                            val name = api.materialFileName(uri)
                            if (selectedUploadUri == uri) {
                                selectedUploadFileName = name
                                selectedUploadTitle = name.substringBeforeLast('.', name)
                                    .replace(Regex("[_-]+"), " ").trim().take(200)
                            }
                        } catch (_: Exception) {
                            if (selectedUploadUri == uri) {
                                materialUploadMessage = "Could not read this file name. Choose the document again."
                            }
                        }
                    }
                }
            }
            val caboColors = lightColorScheme(
                primary = Color(0xFFC4673A), onPrimary = Color(0xFF0D1117),
                secondary = Color(0xFF1D6B6B), onSecondary = Color.White,
                background = Color(0xFFF8F6EF), surface = Color(0xFFFFFEFA),
                surfaceVariant = Color(0xFFF3E6DA), onSurface = Color(0xFF29372F),
                onSurfaceVariant = Color(0xFF68736B), outline = Color(0xFFDDD7C8)
            )
            MaterialTheme(colorScheme = caboColors) {
                BackHandler(enabled = selectedUploadUri != null || creatingSupportRequest || selectedSupportTicket != null || selectedQuiz != null || selectedMaterial != null || selectedWrittenExams || selectedLearnerPassport) {
                    when {
                        selectedUploadUri != null -> closeMaterialUpload()
                        selectedLearnerPassport -> closeLearnerPassport()
                        creatingSupportRequest -> creatingSupportRequest = false
                        selectedSupportTicket != null -> closeSupportTicket()
                        selectedWrittenExams && managerCreatingExam -> { managerCreatingExam = false; loadDashboard() }
                        selectedWrittenExams -> selectedWrittenExams = false
                        else -> closeStudy()
                    }
                }
                when {
                    selectedUploadUri != null -> NativeMaterialUploadScreen(
                        fileName = selectedUploadFileName,
                        title = selectedUploadTitle,
                        busy = materialUploadBusy,
                        message = materialUploadMessage,
                        onTitle = { selectedUploadTitle = it },
                        upload = { uploadSelectedMaterial() },
                        close = { closeMaterialUpload() }
                    )
                    creatingSupportRequest -> if (demoActive) NativeDemoSupportRequestScreen(
                        busy = false, message = null,
                        submit = { concept, question, attempted -> createDemoSupportRequest(concept, question, attempted) },
                        close = { creatingSupportRequest = false }
                    ) else NativeSupportDraftScreen(
                        courses = screen?.supportCourses ?: supportCourseOptions, initial = selectedSupportDraft,
                        busy = supportFormBusy, message = supportFormMessage,
                        save = { saveSupportDraft(it) }, submit = { sendSupportDraft(it) },
                        close = { creatingSupportRequest = false; selectedSupportDraft = null }
                    )
                    selectedSupportTicket != null -> NativeSupportTicketScreen(
                        ticket = supportTicket,
                        canManageSupport = if (demoActive) demoRole in listOf("teacher", "assessor") else (screen?.portal?.role ?: "") in listOf("teacher", "assessor"),
                        reply = supportReply,
                        onReply = { supportReply = it.take(4000) },
                        triageReason = supportTriageReason,
                        onTriageReason = { supportTriageReason = it.take(1000) },
                        guidance = supportGuidance,
                        busy = supportBusy,
                        message = supportMessage,
                        requestGuidance = { draftSupportGuidance() },
                        useGuidance = { supportReply = suggestedReply(supportGuidance) },
                        sendReply = { sendSupportReply() },
                        triage = { triageSupportTicket() },
                        assign = { staffId -> assignSupportEducator(staffId) },
                        schedulePractice = { body, reviewAt -> scheduleSupportPractice(body, reviewAt) },
                        close = { closeSupportTicket() },
                        isLearnerOwner = (!demoActive && screen?.portal?.role == "learner") || (demoActive && demoRole == "learner"),
                        submitFeedback = { value -> submitLearnerSupportFeedback(value) },
                        transition = { status, reason -> transitionSupportTicket(status, reason) },
                        recordOutcome = { baseline, followup, reason -> recordSupportOutcome(baseline, followup, reason) },
                        reviewLearningDna = { state, note -> saveSupportLearningDna(state, note) }
                    )
                    selectedWrittenExams && !managerCreatingExam && (screen?.canManageExamAssignments == true) ->
                        NativeExamManagementScreen(
                            workspaces = screen?.examManagementWorkspaces.orEmpty(),
                            exams = screen?.writtenExams.orEmpty(),
                            busy = busy,
                            assign = { organizationId, groupId, examId, dueAt ->
                                api.createExamAssignment(organizationId, groupId, examId, dueAt)
                                loadDashboard()
                            },
                            overrideMark = { organizationId, submissionId, questionIndex, awardedMarks, reason ->
                                api.overrideExamSubmission(organizationId, submissionId, questionIndex, awardedMarks, reason)
                                loadDashboard()
                            },
                            createExam = { managerCreatingExam = true },
                            close = { selectedWrittenExams = false }
                        )
                    selectedWrittenExams -> NativeWrittenExamScreen(
                        materials = screen?.materialEntries.orEmpty(), exams = screen?.writtenExams.orEmpty(),
                        assignments = if (demoActive && screen?.portal?.role == "learner")
                            listOf(WrittenExamAssignment(73032, 73031, "Demo fractions check", 73001,
                                "Cabo Learning School", null))
                        else screen?.writtenAssignments.orEmpty(),
                        generate = { materialId, count, difficulty ->
                            if (demoActive) WrittenExam(73031, "CABO demo · ${screen?.materialEntries?.firstOrNull { it.id == materialId }?.title ?: "Study material"}", difficulty,
                                List(count) { index -> WrittenExamQuestion(
                                    listOf("Explain one key idea from your study material.", "Give an example of how that idea can be used.") [index % 2],
                                    "short_answer", 5
                                ) })
                            else api.generateWrittenExam(materialId, count, difficulty)
                        },
                        open = { examId ->
                            if (demoActive) throw IllegalStateException("Select a demo exam above.")
                            else api.fetchWrittenExam(examId)
                        },
                        openAssignment = { assignmentId ->
                            if (demoActive) WrittenExam(73031, "CABO demo · Fractions check", "beginner",
                                listOf(WrittenExamQuestion("Explain one key idea from your study material.", "short_answer", 5)))
                            else api.fetchAssignedWrittenExam(assignmentId)
                        },
                        submit = { examId, assignmentId, answers ->
                            if (demoActive) {
                                val marks = answers.mapIndexed { index, answer ->
                                    val awarded = if (answer.trim().length >= 20) 4.0 else 2.0
                                    WrittenExamMark(index, awarded, 5.0,
                                        if (awarded > 2) "Clear response. Add one supporting detail to strengthen it."
                                        else "Add more detail and connect your explanation to the study material.", false)
                                }
                                val total = marks.sumOf { it.maxMarks }
                                val awarded = marks.sumOf { it.awardedMarks }
                                WrittenExamResult(73099, awarded * 100.0 / total, awarded, total, 0, marks)
                            } else api.submitWrittenExam(examId, answers, assignmentId)
                        },
                        isDemo = demoActive,
                        close = {
                            if (screen?.canManageExamAssignments == true) {
                                managerCreatingExam = false
                                loadDashboard()
                            } else selectedWrittenExams = false
                        }
                    )
                    selectedLearnerPassport -> NativeLearnerPassportScreen(
                        passport = learnerPassport,
                        busy = learnerPassportBusy,
                        message = learnerPassportMessage,
                        refresh = { loadLearnerPassport() },
                        share = {
                            val data = learnerPassport ?: return@NativeLearnerPassportScreen
                            val send = Intent(Intent.ACTION_SEND).apply {
                                type = "application/json"
                                putExtra(Intent.EXTRA_TEXT, data.json)
                            }
                            startActivity(Intent.createChooser(send, "Export learner passport"))
                        },
                        close = { closeLearnerPassport() }
                    )
                    selectedQuiz != null -> NativeQuizScreen(
                        summary = selectedQuiz!!, quiz = activeQuiz, answers = answers,
                        attempt = attempt, busy = studyBusy, submitted = studySubmitted,
                        message = studyMessage, uncertain = studyUnconfirmed,
                        recover = { recoverQuiz() },
                        answer = { question, option ->
                            if (!studySubmitted && !studyBusy && question in answers.indices) {
                                answers = answers.toMutableList().also { it[question] = option }
                            }
                        },
                        submit = { submitQuiz() }, close = { closeStudy() }
                    )
                    selectedMaterial != null -> NativeMaterialScreen(
                        summary = selectedMaterial!!, content = studyText,
                        nextOffset = nextPage, busy = studyBusy, message = studyMessage,
                        next = { readNextPage() }, close = { closeStudy() }
                    )
                    else -> NativeHome(
                        status = status, busy = busy, data = screen?.copy(supportDrafts = supportDrafts),
                        signIn = { startSignIn() },
                        refresh = { if (demoActive) switchDemoRole(demoRole) else loadDashboard() },
                        demoEnabled = BuildConfig.ENABLE_DEMO_MODE,
                        demoActive = demoActive,
                        demoRole = demoRole,
                        startDemo = { startDemo() },
                        setDemoRole = { switchDemoRole(it) },
                        createSupportRequest = { creatingSupportRequest = true; selectedSupportDraft = null; supportFormMessage = null },
                        testLoginAvailable = api.testLoginAvailable(),
                        testUsername = testUsername, testPassword = testPassword,
                        onTestUsername = { testUsername = it },
                        onTestPassword = { testPassword = it },
                        signInTest = { startTestSignIn() },
                        signOut = { signOut() },
                        respondToInvite = { invitationId, accept -> respondToInvite(invitationId, accept) },
                        setNotificationPreference = { org, kind, enabled, acknowledged ->
                            setNotificationPreference(org, kind, enabled, acknowledged)
                        },
                        reviewGuardian = { organizationId, relationshipId, decision ->
                            reviewGuardianRelationship(organizationId, relationshipId, decision)
                        },
                        submitSchoolReport = { organizationId, learnerId, year ->
                            submitSchoolReport(organizationId, learnerId, year)
                        },
                        decideSchoolReport = { organizationId, reportId, action, reason ->
                            decideSchoolReport(organizationId, reportId, action, reason)
                        },
                        verifyIssuedReport = { verifyIssuedReport(it) },
                        publishSchoolNotice = { org, title, body, audience -> publishSchoolNotice(org, title, body, audience) },
                        recordSchoolAttendance = { org, learner, day, attendanceStatus, note -> recordSchoolAttendance(org, learner, day, attendanceStatus, note) },
                        substituteSchoolTeacher = { org, slot, teacher, reason -> substituteSchoolTeacher(org, slot, teacher, reason) },
                        createAssessmentQuestion = { org, grade, subject, curriculum, stem, answer, rubric, attribution, license ->
                            createAssessmentQuestion(org, grade, subject, curriculum, stem, answer, rubric, attribution, license)
                        },
                        decideAssessmentQuestion = { org, question, action, note -> decideAssessmentQuestion(org, question, action, note) },
                        createAssessmentPaper = { org, year, grade, subject, curriculum, title, ids ->
                            createAssessmentPaper(org, year, grade, subject, curriculum, title, ids)
                        },
                        decideAssessmentPaper = { org, paper, action, note -> decideAssessmentPaper(org, paper, action, note) },
                        openSupportTicket = { openSupportTicket(it) },
                        openQuiz = { openQuiz(it) },
                        openMaterial = { openMaterial(it) },
                        openWrittenExams = {
                            if (!demoActive && screen?.canManageExamAssignments == true) {
                                busy = true
                                lifecycleScope.launch {
                                    try {
                                        val workspaces = api.fetchExamManagementWorkspaces()
                                        val resources = api.fetchExamManagementResources()
                                        screen = screen?.copy(examManagementWorkspaces = workspaces,
                                            materialEntries = resources.materials, materials = resources.materials.map { it.title },
                                            writtenExams = resources.exams)
                                    }
                                    catch (_: Exception) { status = "Exam workspace could not be loaded. Check your connection and try again." }
                                    finally { busy = false; selectedWrittenExams = true }
                                }
                            } else selectedWrittenExams = true
                        },
                        openLearnerPassport = { openLearnerPassport() },
                        pickMaterial = { if (!demoActive) materialPicker.launch(arrayOf("*/*")) },
                        openSupportDraft = { draft -> selectedSupportDraft = draft; supportFormMessage = null; creatingSupportRequest = true },
                        sendSupportDraft = { sendSupportDraft(it) },
                        deleteSupportDraft = { deleteSupportDraft(it) },
                        offlineSupportDrafts = supportDrafts,
                        offlineSupportCourses = supportCourseOptions,
                        learnerJourneyAction = { performLearnerJourneyAction(it) }
                    )
                }
            }
        }
        if (intent.data?.scheme == "cabo-learninghub-android") handleCallback(intent)
        else if (api.hasSession()) loadDashboard()
        else status = "Sign in to load your private CABO dashboard"
    }

    // Called when the existing activity receives the browser handoff.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.data?.scheme == "cabo-learninghub-android") handleCallback(intent)
    }

    private fun startSignIn() {
        try { startActivity(api.authorize()) }
        catch (_: Exception) { status = "No browser could be opened for secure sign-in." }
    }

    private fun startTestSignIn() {
        if (busy || !api.testLoginAvailable() || testPassword.isEmpty()) return
        val account = testUsername
        val secret = testPassword
        testPassword = ""
        busy = true
        lifecycleScope.launch {
            try {
                status = api.testLogin(account, secret)
            } finally { busy = false }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun startDemo() {
        if (!BuildConfig.ENABLE_DEMO_MODE || busy || supportBusy || studyBusy) return
        NativeDemoSession.reset()
        demoActive = true
        demoRole = "learner"
        screen = NativeDemoData.learner()
        status = "CABO demo · sample data only · no account connected"
    }

    private fun openLearnerPassport() {
        selectedLearnerPassport = true
        if (demoActive) {
            learnerPassport = null
            learnerPassportMessage = "Passport export needs a connected learner account. Synthetic demo data is not exported."
        } else loadLearnerPassport()
    }

    private fun loadLearnerPassport() {
        if (demoActive) {
            learnerPassportMessage = "Passport export needs a connected learner account. Synthetic demo data is not exported."
            return
        }
        if (learnerPassportBusy) return
        learnerPassportBusy = true
        learnerPassportMessage = null
        lifecycleScope.launch {
            try {
                learnerPassport = api.fetchLearnerPassport()
            } catch (_: Exception) {
                learnerPassport = null
                learnerPassportMessage = "Learner passport is unavailable for this account right now. Refresh to try again."
            } finally {
                learnerPassportBusy = false
            }
        }
    }

    private fun closeLearnerPassport() {
        selectedLearnerPassport = false
        learnerPassport = null
        learnerPassportMessage = null
    }

    private fun closeMaterialUpload() {
        if (materialUploadBusy) return
        selectedUploadUri = null
        selectedUploadFileName = ""
        selectedUploadTitle = ""
        materialUploadMessage = null
    }

    private fun uploadSelectedMaterial() {
        val uri = selectedUploadUri ?: return
        if (demoActive || materialUploadBusy || busy) return
        materialUploadBusy = true
        materialUploadMessage = null
        lifecycleScope.launch {
            try {
                val saved = api.uploadMaterial(uri, selectedUploadTitle)
                selectedUploadUri = null
                selectedUploadFileName = ""
                selectedUploadTitle = ""
                status = "${saved.title} was added to your private study library."
                loadDashboard()
            } catch (_: Exception) {
                materialUploadMessage = "Could not add this file. Check that it is supported, under 30 MB, and try again online."
            } finally {
                materialUploadBusy = false
            }
        }
    }

    private fun switchDemoRole(role: String) {
        if (!demoActive || role !in listOf("learner", "teacher", "parent")) return
        closeSupportTicket()
        demoRole = role
        screen = NativeDemoData.forRole(role)
        status = "CABO demo · ${role.replaceFirstChar { it.uppercase() }} workspace"
    }

    private fun createDemoSupportRequest(concept: String, question: String, attempted: String) {
        if (!demoActive || concept.trim().length < 2 || question.trim().length < 10 || attempted.trim().length < 3) return
        NativeDemoSession.createRequest(concept, question, attempted)
        screen = NativeDemoData.learner()
        creatingSupportRequest = false
        status = "Request saved on this device. Switch to Teacher to review it."
    }

    private fun saveSupportDraft(draft: NativeSupportDraft) {
        if (demoActive || supportFormBusy) return
        supportFormBusy = true
        supportFormMessage = null
        lifecycleScope.launch {
            try {
                supportDrafts = api.saveSupportDraft(draft)
                selectedSupportDraft = null
                creatingSupportRequest = false
                status = "Draft saved securely on this device."
            } catch (_: Exception) {
                supportFormMessage = "Could not save this draft on the device. Try again."
            } finally { supportFormBusy = false }
        }
    }

    private fun sendSupportDraft(draft: NativeSupportDraft) {
        if (demoActive || supportFormBusy) return
        supportFormBusy = true
        supportFormMessage = null
        lifecycleScope.launch {
            try {
                supportDrafts = api.saveSupportDraft(draft)
                api.submitSupportDraft(draft)
                supportDrafts = api.deleteSupportDraft(draft.requestKey)
                selectedSupportDraft = null
                creatingSupportRequest = false
                status = "Support request sent to your school."
                supportFormBusy = false
                loadDashboard()
                return@launch
            } catch (_: Exception) {
                supportFormMessage = "Saved securely on this device. Reconnect and try sending again."
            } finally { supportFormBusy = false }
        }
    }

    private fun deleteSupportDraft(draft: NativeSupportDraft) {
        if (supportFormBusy) return
        supportFormBusy = true
        lifecycleScope.launch {
            try { supportDrafts = api.deleteSupportDraft(draft.requestKey) }
            catch (_: Exception) { status = "Could not remove this saved draft." }
            finally { supportFormBusy = false }
        }
    }

    private fun handleCallback(callback: Intent) {
        if (busy) return
        busy = true
        lifecycleScope.launch {
            status = api.complete(callback)
            busy = false
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun loadDashboard() {
        if (busy) return
        busy = true
        lifecycleScope.launch {
            try {
                supportDrafts = try { api.loadSupportDrafts() } catch (_: Exception) { supportDrafts }
                supportCourseOptions = try { api.loadCachedSupportCourses() } catch (_: Exception) { supportCourseOptions }
                screen = api.dashboard()
                supportDrafts = if (screen?.portal?.role == "learner") api.loadSupportDrafts() else emptyList()
                supportCourseOptions = if (screen?.portal?.role == "learner") screen?.supportCourses.orEmpty() else emptyList()
                status = "Connected securely as ${screen?.portal?.role ?: "CABO user"}"
            } catch (_: Exception) {
                screen = null
                status = if (api.hasSession())
                    "Could not load your learning records. Check your connection and retry."
                else "Session expired. Sign in again."
            } finally { busy = false }
        }
    }

    private fun respondToInvite(invitationId: Int, accept: Boolean) {
        if (demoActive) {
            screen = screen?.let { current -> current.copy(guardians = current.guardians.map { invite ->
                if (invite.id == invitationId) invite.copy(status = if (accept) "accepted" else "declined")
                else invite
            }) }
            status = if (accept) "Demo invitation accepted locally." else "Demo invitation declined locally."
            return
        }
        if (busy || invitationId <= 0) return
        busy = true
        lifecycleScope.launch {
            try {
                api.respondToGuardianInvite(invitationId, accept)
                status = if (accept) "Invitation accepted. School verification is still required."
                    else "Invitation declined."
            } catch (_: Exception) {
                status = "Could not update this invitation. Please retry."
            } finally {
                busy = false
            }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun reviewGuardianRelationship(organizationId: Int, relationshipId: Int, decision: String) {
        if (demoActive || busy || organizationId <= 0 || relationshipId <= 0 || decision !in setOf("verified", "revoked")) return
        busy = true
        lifecycleScope.launch {
            try {
                api.reviewGuardianRelationship(organizationId, relationshipId, decision)
                status = if (decision == "verified") "Guardian authority review recorded."
                    else "Guardian access revoked."
            } catch (_: Exception) {
                status = "Could not update this guardian relationship. Refresh and check the school review requirements."
            } finally { busy = false }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun setNotificationPreference(organizationId: Int, kind: String, enabled: Boolean, acknowledged: Boolean) {
        if (busy || screen?.portal?.role != "parent") return
        if (demoActive) {
            if (enabled && !acknowledged) return
            screen = screen?.let { current ->
                current.copy(notificationPreferences = current.notificationPreferences.copy(
                    schools = current.notificationPreferences.schools.map { school ->
                        if (school.id != organizationId) school else school.copy(choices = school.choices.map { choice ->
                            if (choice.kind == kind) choice.copy(enabled = enabled) else choice
                        })
                    }
                ))
            }
            status = if (enabled) "Demo email preference saved on this device only."
                else "Demo email preference turned off on this device only."
            return
        }
        busy = true
        lifecycleScope.launch {
            try {
                api.setNotificationPreference(organizationId, kind, enabled, acknowledged)
                status = if (enabled) "Email preference confirmed." else "Email preference turned off."
                busy = false
                loadDashboard()
            } catch (_: Exception) {
                status = if (enabled) "Could not enable this preference. Verified sign-in and explicit consent are required."
                    else "Could not turn this preference off. Check your connection and retry."
                busy = false
            }
        }
    }

    private fun submitSchoolReport(organizationId: Int, learnerId: String, year: Int) {
        if (demoActive || busy) return
        busy = true
        lifecycleScope.launch {
            try {
                api.submitSchoolReport(organizationId, learnerId, year)
                status = "Report snapshot submitted for independent review."
            } catch (_: Exception) {
                status = "Could not submit this report. Check enrolment and published assessment results."
            } finally { busy = false }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun decideSchoolReport(organizationId: Int, reportId: Int, action: String, reason: String) {
        if (demoActive || busy || action !in setOf("approve", "reject", "issue", "revoke")) return
        busy = true
        lifecycleScope.launch {
            try {
                api.decideSchoolReport(organizationId, reportId, action, reason)
                status = "Report workflow updated: ${action.replaceFirstChar { it.uppercase() }}."
            } catch (_: Exception) {
                status = "Report action failed. Check the two-reviewer rule, report status, integrity, and required reason."
            } finally { busy = false }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun verifyIssuedReport(report: IssuedSchoolReport) {
        if (busy || demoActive) return
        busy = true
        lifecycleScope.launch {
            try {
                val verification = api.verifyIssuedReport(report)
                screen = screen?.let { current -> current.copy(
                    issuedReportIntegrity = current.issuedReportIntegrity + (report.key to verification)
                ) }
                status = when {
                    verification.hashValid == null -> "This report uses a legacy digest that cannot be verified."
                    !verification.hashValid -> "Warning: the report content hash does not match."
                    verification.signatureValid -> "Cryptographic signature verified. Issuer accreditation is not asserted."
                    verification.cryptographicallySigned -> "A signature is present but is not trusted or did not validate."
                    else -> "Report content integrity checked. No cryptographic signature is configured."
                }
            } catch (_: Exception) {
                status = "Unable to verify this report right now. Check your connection and access."
            } finally { busy = false }
        }
    }

    private fun publishSchoolNotice(organizationId: Int, subject: String, message: String, audience: String) {
        if (demoActive || busy || screen?.schoolOperations?.none { it.organizationId == organizationId && it.canManage } != false) return
        busy = true
        lifecycleScope.launch {
            try { api.publishSchoolNotice(organizationId, subject, message, audience); status = "Notice published to the selected school audience." }
            catch (_: Exception) { status = "Could not publish the notice. Confirm school administrator access and try again." }
            finally { busy = false }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun recordSchoolAttendance(organizationId: Int, learnerId: String, day: String, attendanceStatus: String, note: String) {
        if (demoActive || busy || screen?.schoolOperations?.none { it.organizationId == organizationId && it.canManage } != false) return
        busy = true
        lifecycleScope.launch {
            try { api.recordSchoolAttendance(organizationId, learnerId, day, attendanceStatus, note); status = "Attendance saved by the school." }
            catch (_: Exception) { status = "Could not save attendance. Confirm the learner belongs to this institution and retry." }
            finally { busy = false }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun substituteSchoolTeacher(organizationId: Int, slotId: Int, replacementTeacherId: String, reason: String) {
        if (demoActive || busy || screen?.schoolOperations?.none { it.organizationId == organizationId && it.canManage } != false) return
        busy = true
        lifecycleScope.launch {
            try { api.substituteSchoolTeacher(organizationId, slotId, replacementTeacherId, reason); status = "Teacher substitution recorded and audited." }
            catch (_: Exception) { status = "Substitution was not saved. Check staff membership, reason, and timetable conflicts." }
            finally { busy = false }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun createAssessmentQuestion(organizationId: Int, grade: String, subject: String, curriculum: String,
                                         stem: String, answerGuide: String, rubric: String, attribution: String, license: String) {
        if (demoActive || busy || screen?.assessmentWorkspaces?.none { it.organizationId == organizationId &&
                it.membershipRole in setOf("owner", "admin", "teacher") } != false) return
        busy = true
        lifecycleScope.launch {
            try { api.createAssessmentQuestion(organizationId, grade, subject, curriculum, stem, answerGuide, rubric, attribution, license); status = "Question saved as a draft." }
            catch (_: Exception) { status = "Could not save the question. Check source attribution, license and school access." }
            finally { busy = false }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun decideAssessmentQuestion(organizationId: Int, questionId: Int, action: String, note: String) {
        if (demoActive || busy || screen?.assessmentWorkspaces?.none { it.organizationId == organizationId } != false) return
        busy = true
        lifecycleScope.launch {
            try { api.decideAssessmentQuestion(organizationId, questionId, action, note); status = "Question workflow updated." }
            catch (_: Exception) { status = "Question action was not accepted. Independent review and school-role rules apply." }
            finally { busy = false }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun createAssessmentPaper(organizationId: Int, year: Int, grade: String, subject: String,
                                      curriculum: String, title: String, questionIds: List<Int>) {
        if (demoActive || busy || screen?.assessmentWorkspaces?.none { it.organizationId == organizationId &&
                it.membershipRole in setOf("owner", "admin", "teacher") } != false) return
        busy = true
        lifecycleScope.launch {
            try { api.createAssessmentPaper(organizationId, year, grade, subject, curriculum, title, questionIds); status = "Paper saved as a draft." }
            catch (_: Exception) { status = "Could not create the paper. Use published questions for the same grade, subject and curriculum." }
            finally { busy = false }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun decideAssessmentPaper(organizationId: Int, paperId: Int, action: String, note: String) {
        if (demoActive || busy || screen?.assessmentWorkspaces?.none { it.organizationId == organizationId } != false) return
        busy = true
        lifecycleScope.launch {
            try { api.decideAssessmentPaper(organizationId, paperId, action, note); status = "Assessment paper workflow updated." }
            catch (_: Exception) { status = "Paper action was not accepted. Independent review and school-role rules apply." }
            finally { busy = false }
            if (api.hasSession()) loadDashboard()
        }
    }

    private fun performLearnerJourneyAction(action: LearnerJourneyAction) {
        if (busy || screen?.portal?.role != "learner") return
        if (demoActive) {
            val current = screen ?: return
            screen = when (action) {
                is LearnerJourneyAction.SaveIdentity -> current.copy(journeyIdentity = LearnerJourneyIdentity(action.displayName.take(160)))
                is LearnerJourneyAction.AddEntry -> current.copy(journeyEntries = current.journeyEntries + LearnerJourneyEntry(
                    -(current.journeyEntries.size + 1), action.institution.take(160), action.stage, action.year, action.note.take(2000)))
                is LearnerJourneyAction.AddMilestone -> current.copy(journeyMilestones = current.journeyMilestones + LearnerJourneyMilestone(
                    -(current.journeyMilestones.size + 1), action.title.take(160), action.description.take(4000), action.kind, action.year))
                is LearnerJourneyAction.DeleteEntry -> current.copy(journeyEntries = current.journeyEntries.filterNot { it.id == action.id })
                is LearnerJourneyAction.DeleteMilestone -> current.copy(journeyMilestones = current.journeyMilestones.filterNot { it.id == action.id })
            }
            status = "Demo journey updated on this device only."
            return
        }
        busy = true
        lifecycleScope.launch {
            try {
                when (action) {
                    is LearnerJourneyAction.SaveIdentity -> api.saveJourneyIdentity(action.displayName)
                    is LearnerJourneyAction.AddEntry -> api.addJourneyEntry(action.institution, action.stage, action.year, action.note)
                    is LearnerJourneyAction.AddMilestone -> api.addJourneyMilestone(action.title, action.description, action.kind, action.year)
                    is LearnerJourneyAction.DeleteEntry -> api.deleteJourneyItem("/api/learner-journey/entries/${action.id}")
                    is LearnerJourneyAction.DeleteMilestone -> api.deleteJourneyItem("/api/learner-journey/milestones/${action.id}")
                }
                status = "Your private journey has been saved."
                screen = api.dashboard()
            } catch (_: Exception) {
                status = "Could not save this journey change. Check your connection and try again."
            } finally { busy = false }
        }
    }

    private fun openQuiz(summary: QuizSummary) {
        if (busy || studyBusy || screen == null) return
        selectedQuiz = summary
        activeQuiz = null
        answers = emptyList()
        attempt = null
        studyMessage = null
        studySubmitted = false
        studyUnconfirmed = false
        submissionKey = java.util.UUID.randomUUID().toString()
        if (demoActive) {
            activeQuiz = NativeDemoData.quiz(summary.id)
            answers = List(activeQuiz!!.questions.size) { null }
            studyMessage = "Synthetic demo assessment · your choices stay on this device."
            return
        }
        studyBusy = true
        lifecycleScope.launch {
            try {
                val loaded = api.fetchQuiz(summary.id)
                activeQuiz = loaded
                answers = List(loaded.questions.size) { null }
            } catch (_: Exception) {
                studyMessage = "Cannot open this test. Check your connection and return to your dashboard."
            } finally { studyBusy = false }
        }
    }

    private fun submitQuiz() {
        val quiz = activeQuiz ?: return
        if (studyBusy || studySubmitted || answers.size != quiz.questions.size ||
            answers.any { it == null }) return
        studySubmitted = true // Do not reset after a network timeout: it might have committed.
        if (demoActive) {
            val correctOptions = if (quiz.id == 73022) listOf(0, 0) else listOf(1, 1, 1)
            val feedback = quiz.questions.mapIndexed { index, question ->
                val correct = answers[index] == correctOptions.getOrElse(index) { 0 }
                QuizFeedback(index, correct, if (correct)
                    "Good check: compare the answer with the worked example."
                else "Review the worked example, then try another practice question.")
            }
            val score = feedback.count { it.isCorrect }
            attempt = QuizAttempt(
                id = 73099,
                quizId = quiz.id,
                correctCount = score,
                totalQuestions = quiz.questions.size,
                percentage = score * 100.0 / quiz.questions.size,
                feedback = feedback
            )
            studyUnconfirmed = false
            studyMessage = "Demo result calculated locally. It is not an official mark."
            return
        }
        studyBusy = true
        lifecycleScope.launch {
            try {
                val graded = api.submitQuiz(quiz.id, answers.map { it!! }, submissionKey)
                if (graded.quizId != quiz.id || graded.totalQuestions != quiz.questions.size)
                    throw IllegalStateException("Unexpected grade response")
                attempt = graded
                studyUnconfirmed = false
                studyMessage = "Practice assessment graded by CABO."
            } catch (_: Exception) {
                studyUnconfirmed = true
                studyMessage = "Submission status uncertain. Check its status without posting twice."
            } finally { studyBusy = false }
        }
    }

    private fun recoverQuiz() {
        val id = activeQuiz?.id ?: return
        if (studyBusy || !studySubmitted || submissionKey.isEmpty()) return
        studyBusy = true
        lifecycleScope.launch {
            try {
                val graded = api.lookupQuiz(id, submissionKey)
                if (graded.totalQuestions != activeQuiz?.questions?.size)
                    throw IllegalStateException("Result mismatch")
                attempt = graded
                studyUnconfirmed = false
                studyMessage = "Saved result confirmed by CABO."
            } catch (_: Exception) {
                studyMessage = "Result not confirmed yet. Contact your educator if it remains unavailable."
            } finally { studyBusy = false }
        }
    }

    private fun openMaterial(summary: MaterialSummary) {
        if (busy || studyBusy || screen == null) return
        selectedMaterial = summary
        studyText = ""
        nextPage = 0
        studyMessage = null
        if (demoActive) {
            readNextPage()
            return
        }
        readNextPage()
    }

    private fun readNextPage() {
        val id = selectedMaterial?.id ?: return
        val offset = nextPage ?: return
        if (studyBusy) return
        if (demoActive) {
            val page = NativeDemoData.materialPage(id, offset)
            studyText += page.text + "\n\n"
            nextPage = page.nextOffset
            return
        }
        studyBusy = true
        lifecycleScope.launch {
            try {
                val page = api.fetchMaterialPage(id, offset)
                studyText += page.text
                nextPage = page.nextOffset
                studyMessage = null
            } catch (_: Exception) {
                studyMessage = "Cannot read this document right now. A text-based version or an internet connection may be required."
            } finally { studyBusy = false }
        }
    }

    private fun closeStudy() {
        if (studyBusy) return
        selectedQuiz = null
        selectedMaterial = null
        activeQuiz = null
        answers = emptyList()
        attempt = null
        studyText = ""
        nextPage = null
        studySubmitted = false
        studyUnconfirmed = false
        submissionKey = ""
        studyMessage = null
    }

    private fun signOut() {
        if (busy) return
        busy = true
        lifecycleScope.launch {
            if (!demoActive) {
                api.clearSupportDrafts()
                api.signOut()
            }
            supportDrafts = emptyList()
            supportCourseOptions = emptyList()
            selectedSupportDraft = null
            closeStudy()
            demoActive = false
            selectedSupportTicket = null
            creatingSupportRequest = false
            supportTicket = null
            supportGuidance = null
            screen = null
            status = "Signed out on this device."
            busy = false
        }
    }

    private fun suggestedReply(draft: SupportGuidanceDraft?): String {
        if (draft == null) return supportReply
        return buildString {
            append(draft.explanation)
            if (draft.questions.isNotEmpty()) {
                append("\n\nQuestions to consider:\n")
                draft.questions.forEach { append("• ").append(it).append('\n') }
            }
            if (draft.practice.isNotEmpty()) {
                append("\nPractice:\n")
                draft.practice.forEach { append("• ").append(it).append('\n') }
            }
        }.trim().take(4000)
    }

    private fun openSupportTicket(summary: SupportTicketSummary) {
        if (busy || supportBusy || screen == null) return
        selectedSupportTicket = summary
        supportTicket = if (demoActive) NativeDemoSession.ticket(summary) else null
        supportReply = ""
        supportTriageReason = "Reviewed by the assigned educator."
        supportGuidance = null
        supportMessage = null
        if (demoActive) return
        supportBusy = true
        lifecycleScope.launch {
            try {
                supportTicket = api.fetchSupportTicket(summary)
                selectedSupportTicket = supportTicket?.summary
            } catch (_: Exception) {
                supportMessage = "Could not load this request. Refresh your dashboard and try again."
            } finally { supportBusy = false }
        }
    }

    private fun closeSupportTicket() {
        if (supportBusy) return
        selectedSupportTicket = null
        supportTicket = null
        supportReply = ""
        supportGuidance = null
        supportMessage = null
    }

    private fun updateSupportSummary(summary: SupportTicketSummary) {
        screen = screen?.let { current ->
            val learnerTickets = current.learnerSupportTickets.map {
                if (it.id == summary.id && it.organizationId == summary.organizationId) summary else it
            }
            current.copy(staff = current.staff.map { workspace ->
                if (workspace.organizationId != summary.organizationId) workspace else workspace.copy(
                    tickets = workspace.tickets.map { if (it.id == summary.id) summary else it }
                )
            }, learnerSupportTickets = learnerTickets,
                learnerHelp = learnerTickets.map { "${it.concept} · ${it.status.replace('_', ' ')}" })
        }
    }

    private fun draftSupportGuidance() {
        val summary = supportTicket?.summary ?: return
        if (supportBusy) return
        if (demoActive) {
            val guidance = when {
                summary.concept.contains("fraction", ignoreCase = true) -> SupportGuidanceDraft(
                    explanation = "To add fractions with different denominators, rewrite them as equivalent fractions with the same denominator. For thirds and fourths, twelfths work because 12 is a multiple of both 3 and 4.",
                    questions = listOf("How many twelfths are equal to one third?", "How many twelfths are equal to one quarter?"),
                    practice = listOf("Rewrite 1/3 and 1/4 in twelfths.", "Add the numerators and keep the denominator."),
                    source = "non_ai_template"
                )
                summary.concept.contains("read", ignoreCase = true) || summary.concept.contains("evidence", ignoreCase = true) -> SupportGuidanceDraft(
                    explanation = "Invite the learner to point to a sentence or detail that supports their answer, then connect that evidence to the question.",
                    questions = listOf("Which detail helped you decide?", "How does that detail support your answer?"),
                    practice = listOf("Choose one claim in a short paragraph.", "Underline a sentence that supports it and explain why."),
                    source = "non_ai_template"
                )
                else -> SupportGuidanceDraft(
                    explanation = "Break ${summary.concept} into a small example the learner can explain step by step. Ask them to show the point where they became unsure.",
                    questions = listOf("What part feels clear so far?", "Where did your answer start to differ from the example?"),
                    practice = listOf("Work through one short example together.", "Ask the learner to explain the next step in their own words."),
                    source = "non_ai_template"
                )
            }
            supportGuidance = guidance
            supportMessage = "Synthetic guidance draft ready. Review it before adding it to your reply."
            return
        }
        supportBusy = true
        supportMessage = null
        lifecycleScope.launch {
            try {
                supportGuidance = api.requestSupportGuidance(summary)
                supportMessage = "Draft ready. Review and edit it before adding it to your reply."
            } catch (_: Exception) {
                supportMessage = "A guidance draft is unavailable right now. You can still write a reply."
            } finally { supportBusy = false }
        }
    }

    private fun sendSupportReply() {
        val summary = supportTicket?.summary ?: return
        if (supportBusy || supportReply.trim().length !in 2..4000) return
        if (demoActive) {
            val current = NativeDemoSession.reply(summary, supportReply.trim())
            supportTicket = current
            updateSupportSummary(current.summary)
            selectedSupportTicket = current.summary
            supportReply = ""
            supportGuidance = null
            supportMessage = "Demo reply added locally. Nothing was sent to a real learner."
            return
        }
        supportBusy = true
        supportMessage = null
        lifecycleScope.launch {
            try {
                val updated = api.replyToSupportTicket(summary, supportReply)
                updateSupportSummary(updated)
                supportTicket = api.fetchSupportTicket(updated)
                selectedSupportTicket = supportTicket?.summary
                supportReply = ""
                supportGuidance = null
                supportMessage = "Reply sent to the learner."
            } catch (_: Exception) {
                supportMessage = "Reply was not confirmed. Refresh the request before trying again."
            } finally { supportBusy = false }
        }
    }

    private fun triageSupportTicket() {
        val summary = supportTicket?.summary ?: return
        if (supportBusy || summary.status != "open" || supportTriageReason.trim().length !in 3..1000) return
        if (demoActive) {
            val current = NativeDemoSession.triage(summary, supportTriageReason.trim())
            supportTicket = current
            updateSupportSummary(current.summary)
            selectedSupportTicket = current.summary
            supportMessage = "Demo request marked as triaged locally."
            return
        }
        supportBusy = true
        supportMessage = null
        lifecycleScope.launch {
            try {
                val updated = api.triageSupportTicket(summary, supportTriageReason)
                updateSupportSummary(updated)
                supportTicket = api.fetchSupportTicket(updated)
                selectedSupportTicket = supportTicket?.summary
                supportMessage = "Request marked as triaged."
            } catch (_: Exception) {
                supportMessage = "The request changed or could not be triaged. Refresh it before trying again."
            } finally { supportBusy = false }
        }
    }

    private fun assignSupportEducator(staffId: String) {
        val current = supportTicket ?: return
        if (supportBusy || staffId.isBlank()) return
        supportBusy = true; supportMessage = null
        lifecycleScope.launch {
            try {
                val updated = api.assignSupportTicket(current, staffId)
                updateSupportSummary(updated)
                supportTicket = api.fetchSupportTicket(updated)
                selectedSupportTicket = supportTicket?.summary
                supportMessage = "Authorised educator assigned."
            } catch (_: Exception) { supportMessage = "Could not assign this request. Refresh it before trying again." }
            finally { supportBusy = false }
        }
    }

    private fun scheduleSupportPractice(body: String, reviewAt: String) {
        val current = supportTicket ?: return
        if (supportBusy || body.trim().length !in 5..4000) return
        if (demoActive) {
            val updated = current.copy(
                summary = current.summary.copy(reviewAt = reviewAt),
                history = current.history + SupportTicketEvent("practice", body.trim(), reviewAt)
            )
            supportTicket = updated
            updateSupportSummary(updated.summary)
            supportMessage = "Synthetic practice checkpoint saved on this device. Nothing was sent to a school."
            return
        }
        supportBusy = true; supportMessage = null
        lifecycleScope.launch {
            try {
                val updated = api.scheduleSupportPractice(current, body, reviewAt)
                updateSupportSummary(updated)
                supportTicket = api.fetchSupportTicket(updated)
                selectedSupportTicket = supportTicket?.summary
                supportMessage = "Practice and review checkpoint saved."
            } catch (_: Exception) { supportMessage = "Could not save the practice checkpoint. Choose a future time and retry." }
            finally { supportBusy = false }
        }
    }

    private fun submitLearnerSupportFeedback(value: String) {
        val current = supportTicket ?: return
        if (supportBusy) return
        if (demoActive) {
            supportTicket = NativeDemoSession.feedback(current.summary, value)
            updateSupportSummary(supportTicket!!.summary)
            supportMessage = "Synthetic demo feedback saved on this device. Nothing was sent to a school."
            return
        }
        supportBusy = true; supportMessage = null
        lifecycleScope.launch {
            try {
                val updated = api.submitLearnerSupportFeedback(current, value)
                updateSupportSummary(updated)
                supportTicket = api.fetchSupportTicket(updated)
                selectedSupportTicket = supportTicket?.summary
                supportMessage = if (value == "helpful") "Thanks for letting your educator know." else "Your educator will see that you still need help."
            } catch (_: Exception) {
                supportMessage = "Could not send your response. Refresh this request and try again."
            } finally { supportBusy = false }
        }
    }

    private fun transitionSupportTicket(status: String, reason: String) {
        val current = supportTicket ?: return
        if (supportBusy || reason.trim().length !in 3..1000) return
        if (demoActive) {
            supportTicket = NativeDemoSession.transition(current.summary, status, reason)
            updateSupportSummary(supportTicket!!.summary)
            supportMessage = "Synthetic demo status updated on this device. Nothing was sent to a school."
            return
        }
        applySupportAction("Support status updated.") { api.transitionSupportTicket(it, status, reason) }
    }

    private fun recordSupportOutcome(baselineId: Int, followupId: Int, reason: String) {
        if (baselineId == followupId) { supportMessage = "Choose two different published results."; return }
        applySupportAction("Published assessment evidence saved.") {
            api.recordSupportOutcome(it, baselineId, followupId, reason)
        }
    }

    private fun saveSupportLearningDna(state: String, note: String) {
        applySupportAction("Learning DNA review saved.") { api.saveLearningDna(it, state, note) }
    }

    private fun applySupportAction(success: String, action: suspend (SupportTicket) -> SupportTicketSummary) {
        val current = supportTicket ?: return
        if (supportBusy) return
        supportBusy = true; supportMessage = null
        lifecycleScope.launch {
            try {
                val updated = action(current)
                updateSupportSummary(updated)
                supportTicket = api.fetchSupportTicket(updated)
                selectedSupportTicket = supportTicket?.summary
                supportMessage = success
            } catch (_: Exception) {
                supportMessage = "This request changed or the action could not be saved. Refresh and try again."
            } finally { supportBusy = false }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeHome(
    status: String,
    busy: Boolean,
    data: NativeLearning?,
    signIn: () -> Unit,
    refresh: () -> Unit,
    demoEnabled: Boolean,
    demoActive: Boolean,
    demoRole: String,
    startDemo: () -> Unit,
    setDemoRole: (String) -> Unit,
    createSupportRequest: () -> Unit,
    testLoginAvailable: Boolean,
    testUsername: String,
    testPassword: String,
    onTestUsername: (String) -> Unit,
    onTestPassword: (String) -> Unit,
    signInTest: () -> Unit,
    signOut: () -> Unit,
    respondToInvite: (Int, Boolean) -> Unit,
    setNotificationPreference: (Int, String, Boolean, Boolean) -> Unit = { _, _, _, _ -> },
    reviewGuardian: (Int, Int, String) -> Unit = { _, _, _ -> },
    submitSchoolReport: (Int, String, Int) -> Unit = { _, _, _ -> },
    decideSchoolReport: (Int, Int, String, String) -> Unit = { _, _, _, _ -> },
    verifyIssuedReport: (IssuedSchoolReport) -> Unit = {},
    publishSchoolNotice: (Int, String, String, String) -> Unit = { _, _, _, _ -> },
    recordSchoolAttendance: (Int, String, String, String, String) -> Unit = { _, _, _, _, _ -> },
    substituteSchoolTeacher: (Int, Int, String, String) -> Unit = { _, _, _, _ -> },
    createAssessmentQuestion: (Int, String, String, String, String, String, String, String, String) -> Unit = { _, _, _, _, _, _, _, _, _ -> },
    decideAssessmentQuestion: (Int, Int, String, String) -> Unit = { _, _, _, _ -> },
    createAssessmentPaper: (Int, Int, String, String, String, String, List<Int>) -> Unit = { _, _, _, _, _, _, _ -> },
    decideAssessmentPaper: (Int, Int, String, String) -> Unit = { _, _, _, _ -> },
    openSupportTicket: (SupportTicketSummary) -> Unit,
    openQuiz: (QuizSummary) -> Unit,
    openMaterial: (MaterialSummary) -> Unit,
    openWrittenExams: () -> Unit = {},
    pickMaterial: () -> Unit,
    openSupportDraft: (NativeSupportDraft) -> Unit = {},
    sendSupportDraft: (NativeSupportDraft) -> Unit = {},
    deleteSupportDraft: (NativeSupportDraft) -> Unit = {},
    offlineSupportDrafts: List<NativeSupportDraft> = emptyList(),
    offlineSupportCourses: List<SupportCourseOption> = emptyList(),
    learnerJourneyAction: (LearnerJourneyAction) -> Unit = {}
) {
    var section by remember(demoRole) { mutableStateOf("home") }
    val sections = listOf(
        Triple("home", "Home", Icons.Default.Home),
        Triple("learn", "Learn", Icons.Default.School),
        Triple("progress", "Progress", Icons.Default.Assessment),
        Triple("support", if (demoRole == "parent") "Family" else if (demoRole == "learner") "Help" else "Support", Icons.Default.Forum)
    ) + (if (data?.assessmentWorkspaces?.isNotEmpty() == true) listOf(Triple("assessments", "Assessments", Icons.Default.Assessment)) else emptyList()) + (if (data?.schoolOperations?.isNotEmpty() == true) listOf(Triple("school", "School", Icons.Default.AccountBalance)) else emptyList())
    Scaffold(
        containerColor = Color(0xFFF8F6EF),
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
                            Text("CABO", color = Color(0xFFC4673A), fontSize = 20.sp,
                                fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold,
                                letterSpacing = 2.sp, lineHeight = 20.sp)
                            Text("SOLUTIONS", color = Color(0xFFC9A84C), fontSize = 7.sp,
                                fontFamily = FontFamily.Monospace, letterSpacing = 1.1.sp,
                                lineHeight = 9.sp)
                        }
                        Box(Modifier.width(1.dp).height(32.dp).background(Color(0xFFDDD7C8)))
                        Text("Training &\nDevelopment Hub", color = Color(0xFF29372F),
                            style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Medium,
                            lineHeight = 14.sp)
                    }
                },
                navigationIcon = {},
                actions = {
                    if (data != null) {
                        IconButton(onClick = refresh, enabled = !busy) {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh dashboard", tint = Color(0xFFC4673A))
                        }
                        IconButton(onClick = signOut, enabled = !busy) {
                            Icon(Icons.Default.Logout, contentDescription = if (demoActive) "Exit demo" else "Sign out", tint = Color(0xFFC4673A))
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFFF8F6EF))
            )
        },
        bottomBar = {
            if (data != null) {
                NavigationBar(containerColor = Color(0xFFFFFEFA)) {
                    sections.forEach { (key, label, icon) ->
                        NavigationBarItem(
                            selected = section == key,
                            onClick = { section = key },
                            icon = { Icon(icon, contentDescription = null) },
                            label = { Text(label) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Color(0xFFC4673A),
                                selectedTextColor = Color(0xFFC4673A),
                                indicatorColor = Color(0xFFF3E6DA)
                            )
                        )
                    }
                }
            }
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (data == null) {
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("A place to learn.\nRoom to grow.", style = MaterialTheme.typography.headlineMedium,
                        color = Color(0xFF29372F), fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold)
                    Text("Lessons, practice, support and progress for children, families and educators.",
                        style = MaterialTheme.typography.bodyLarge, color = Color(0xFF68736B))
                    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(
                        containerColor = Color(0xFFFFFEFA))) {
                        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(status, color = if (busy) MaterialTheme.colorScheme.primary else Color(0xFF68736B))
                            SessionButtons(data, busy, signIn, refresh, signOut, isDemo = false)
                            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                            if (testLoginAvailable) TestLoginControls(testUsername, testPassword, busy,
                                onTestUsername, onTestPassword, signInTest)
                        }
                    }
                    if (demoEnabled) {
                        OutlinedButton(onClick = startDemo, modifier = Modifier.fillMaxWidth().heightIn(min = 54.dp)) {
                            Text("Explore the CABO demo", fontWeight = FontWeight.SemiBold)
                        }
                        Text("Learner, teacher and parent workspaces · sample data stays on this device",
                            style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
                    }
                    if (offlineSupportDrafts.isNotEmpty()) {
                        ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(
                            containerColor = Color(0xFFE8F0E9))) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text("Saved drafts on this device", style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold)
                                Text("Your unsent learner requests are encrypted here. Connect to send them to your educator.",
                                    style = MaterialTheme.typography.bodyMedium)
                                offlineSupportDrafts.forEach { draft ->
                                    Text(draft.concept, style = MaterialTheme.typography.titleSmall)
                                    Button(onClick = { sendSupportDraft(draft) }, enabled = !busy,
                                        modifier = Modifier.fillMaxWidth()) { Text("Retry sending") }
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        OutlinedButton(onClick = { openSupportDraft(draft) }, enabled = !busy) { Text("Edit") }
                                        TextButton(onClick = { deleteSupportDraft(draft) }, enabled = !busy) { Text("Delete") }
                                    }
                                }
                            }
                        }
                    }
                    if (offlineSupportCourses.isNotEmpty()) {
                        OutlinedButton(onClick = createSupportRequest, enabled = !busy,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                            Text("Start an offline support draft")
                        }
                    }
                    Text("LEARNER · FAMILY · EDUCATOR", style = MaterialTheme.typography.labelLarge,
                        color = Color(0xFFC4673A), letterSpacing = 1.2.sp)
                    NativeCard("Your learning space", "Study resources, practice and progress in one place.")
                    NativeCard("Family connection", "Guardian access follows school verification and enrolment rules.")
                    NativeCard("Educator workspace", "Assigned subjects and learner support stay scoped to your school.")
                }
            } else {
                Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(when(section) {
                                "learn" -> "Your learning space"
                                "progress" -> "Progress & outcomes"
                                "support" -> if (demoRole == "parent") "Family & school connection" else if (demoRole == "learner") "My support" else "Learner support"
                                else -> "Welcome back"
                            }, style = MaterialTheme.typography.titleLarge, color = Color(0xFF29372F),
                                fontWeight = FontWeight.Bold)
                            Text(status, style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
                        }
                        if (busy) CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                    }
                    if (demoActive) {
                        ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(
                            containerColor = Color(0xFFF3E6DA))) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("CABO PREVIEW · sample workspace", style = MaterialTheme.typography.labelLarge,
                                    color = Color(0xFF7A4126), fontWeight = FontWeight.Bold)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf("learner" to "Child", "teacher" to "Teacher", "parent" to "Parent").forEach { (role, label) ->
                                        FilterChip(selected = demoRole == role, onClick = { setDemoRole(role) },
                                            label = { Text(label) }, enabled = !busy)
                                    }
                                }
                            }
                        }
                    }
                }
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                    val tablet = maxWidth >= 600.dp
                    if (tablet) {
                        Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Column(Modifier.width(224.dp).padding(start = 16.dp, top = 12.dp, bottom = 12.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text("YOUR SPACE", color = Color(0xFFC4673A),
                                    style = MaterialTheme.typography.labelLarge, letterSpacing = 1.2.sp)
                                Text(data.portal.role.replace('_', ' ').replaceFirstChar { it.uppercase() },
                                    style = MaterialTheme.typography.headlineSmall, color = Color(0xFF29372F),
                                    fontWeight = FontWeight.Bold)
                                data.portal.summary.take(3).forEach { metric ->
                                    NativeCard(metric, "Current account summary")
                                }
                                Text("Use the sections below to move between learning, progress and support.",
                                    style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
                            }
                            RoleContent(
                                modifier = Modifier.weight(1f).fillMaxHeight(), data = data,
                                section = section, busy = busy, demoActive = demoActive,
                                respondToInvite = respondToInvite, createSupportRequest = createSupportRequest,
                                setNotificationPreference = setNotificationPreference,
                                reviewGuardian = reviewGuardian, submitSchoolReport = submitSchoolReport,
                                decideSchoolReport = decideSchoolReport, verifyIssuedReport = verifyIssuedReport,
                                publishSchoolNotice = publishSchoolNotice, recordSchoolAttendance = recordSchoolAttendance,
                                substituteSchoolTeacher = substituteSchoolTeacher,
                                createAssessmentQuestion = createAssessmentQuestion, decideAssessmentQuestion = decideAssessmentQuestion,
                                createAssessmentPaper = createAssessmentPaper, decideAssessmentPaper = decideAssessmentPaper,
                                openSupportTicket = openSupportTicket, openQuiz = openQuiz, openMaterial = openMaterial, openWrittenExams = openWrittenExams,
                                pickMaterial = pickMaterial, openSupportDraft = openSupportDraft,
                                sendSupportDraft = sendSupportDraft, deleteSupportDraft = deleteSupportDraft,
                                learnerJourneyAction = learnerJourneyAction
                            )
                        }
                    } else {
                        RoleContent(
                            modifier = Modifier.fillMaxSize(), data = data, section = section, busy = busy,
                            demoActive = demoActive,
                            respondToInvite = respondToInvite,
                            setNotificationPreference = setNotificationPreference,
                            reviewGuardian = reviewGuardian, submitSchoolReport = submitSchoolReport,
                            decideSchoolReport = decideSchoolReport, verifyIssuedReport = verifyIssuedReport,
                                publishSchoolNotice = publishSchoolNotice, recordSchoolAttendance = recordSchoolAttendance,
                                substituteSchoolTeacher = substituteSchoolTeacher,
                                createAssessmentQuestion = createAssessmentQuestion, decideAssessmentQuestion = decideAssessmentQuestion,
                                createAssessmentPaper = createAssessmentPaper, decideAssessmentPaper = decideAssessmentPaper,
                            createSupportRequest = createSupportRequest, openSupportTicket = openSupportTicket,
                            openQuiz = openQuiz, openMaterial = openMaterial, openWrittenExams = openWrittenExams, pickMaterial = pickMaterial,
                            openSupportDraft = openSupportDraft, sendSupportDraft = sendSupportDraft,
                            deleteSupportDraft = deleteSupportDraft,
                            learnerJourneyAction = learnerJourneyAction
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AssessmentWorkspaceCard(
    workspace: AssessmentWorkspace,
    busy: Boolean,
    demoActive: Boolean,
    createQuestion: (Int, String, String, String, String, String, String, String, String) -> Unit,
    decideQuestion: (Int, Int, String, String) -> Unit,
    createPaper: (Int, Int, String, String, String, String, List<Int>) -> Unit,
    decidePaper: (Int, Int, String, String) -> Unit
) {
    var grade by remember(workspace.organizationId) { mutableStateOf("Form 2") }
    var subject by remember(workspace.organizationId) { mutableStateOf("Mathematics") }
    var curriculum by remember(workspace.organizationId) { mutableStateOf("National Curriculum") }
    var stem by remember(workspace.organizationId) { mutableStateOf("") }
    var answer by remember(workspace.organizationId) { mutableStateOf("") }
    var rubric by remember(workspace.organizationId) { mutableStateOf("") }
    var attribution by remember(workspace.organizationId) { mutableStateOf("") }
    var license by remember(workspace.organizationId) { mutableStateOf("original") }
    var showLicenses by remember(workspace.organizationId) { mutableStateOf(false) }
    var note by remember(workspace.organizationId) { mutableStateOf("") }
    var paperTitle by remember(workspace.organizationId) { mutableStateOf("") }
    var paperQuestionIds by remember(workspace.organizationId) { mutableStateOf("") }
    var demoDraftQuestionSubmitted by remember(workspace.organizationId) { mutableStateOf(false) }
    var demoDraftPaperSubmitted by remember(workspace.organizationId) { mutableStateOf(false) }
    var demoSavedMessage by remember(workspace.organizationId) { mutableStateOf("") }
    val demoDraftQuestionId = workspace.questions.firstOrNull { it.status == "draft" }?.id
    val demoDraftPaperId = workspace.papers.firstOrNull { it.status == "draft" }?.id

    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFFFFFEFA))) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(workspace.organizationName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("School membership · " + workspace.membershipRole.replace('_', ' '), style = MaterialTheme.typography.bodySmall)
            workspace.notice?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            if (demoSavedMessage.isNotBlank()) Text(demoSavedMessage, style = MaterialTheme.typography.bodySmall, color = Color(0xFF55725E))
            Text("Question bank", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            if (workspace.questions.isEmpty()) Text("No questions are available in this school bank.", style = MaterialTheme.typography.bodySmall)
            workspace.questions.forEach { question ->
                val status = if (demoActive && question.id == demoDraftQuestionId && demoDraftQuestionSubmitted) "submitted" else question.status
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(question.subject + " · " + question.grade + " · " + question.curriculum, style = MaterialTheme.typography.labelSmall)
                    Text(question.stem, fontWeight = FontWeight.SemiBold)
                    Text("Answer guide: " + question.answerGuide, style = MaterialTheme.typography.bodySmall)
                    if (question.rubric.isNotBlank()) Text("Rubric: " + question.rubric, style = MaterialTheme.typography.bodySmall)
                    Text("Source: " + question.sourceAttribution + " · " + question.license, style = MaterialTheme.typography.labelSmall)
                    Text("Status · " + status.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                    if (question.status == "draft" && !demoDraftQuestionSubmitted) {
                        OutlinedButton(
                            onClick = {
                                if (demoActive) { demoDraftQuestionSubmitted = true; demoSavedMessage = "Demo question submitted for independent review on this device." }
                                else decideQuestion(workspace.organizationId, question.id, "submit", "")
                            },
                            enabled = !busy || demoActive, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                        ) { Text("Submit for independent review") }
                    }
                    if (status == "submitted" && workspace.membershipRole in setOf("owner", "admin")) {
                        OutlinedTextField(note, { note = it.take(1500) }, label = { Text("Review or rejection note") }, modifier = Modifier.fillMaxWidth())
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { decideQuestion(workspace.organizationId, question.id, "approve", note) }, enabled = !busy) { Text("Approve") }
                            OutlinedButton(onClick = { decideQuestion(workspace.organizationId, question.id, "reject", note) }, enabled = !busy && note.isNotBlank()) { Text("Reject") }
                        }
                    }
                    if (question.status == "approved" && workspace.membershipRole in setOf("owner", "admin")) {
                        Button(onClick = { decideQuestion(workspace.organizationId, question.id, "publish", "") }, enabled = !busy) { Text("Publish question") }
                    }
                    if (question.status in setOf("published", "rejected") && workspace.membershipRole in setOf("owner", "admin")) {
                        OutlinedTextField(note, { note = it.take(1500) }, label = { Text("Archive reason") }, modifier = Modifier.fillMaxWidth())
                        OutlinedButton(onClick = { decideQuestion(workspace.organizationId, question.id, "archive", note) }, enabled = !busy && note.isNotBlank()) { Text("Archive question") }
                    }
                }
                HorizontalDivider(color = Color(0xFFE7E2D7))
            }

            if (workspace.membershipRole in setOf("owner", "admin", "teacher")) {
                Text("Create an attributed question", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                OutlinedTextField(grade, { grade = it.take(24) }, label = { Text("Grade") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(subject, { subject = it.take(120) }, label = { Text("Subject") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(curriculum, { curriculum = it.take(32) }, label = { Text("Curriculum") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(stem, { stem = it.take(8000) }, label = { Text("Question stem") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(answer, { answer = it.take(8000) }, label = { Text("Answer guide") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(rubric, { rubric = it.take(6000) }, label = { Text("Rubric (optional)") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(attribution, { attribution = it.take(2000) }, label = { Text("Source attribution") }, modifier = Modifier.fillMaxWidth())
                Box {
                    OutlinedButton(onClick = { showLicenses = true }) { Text("License · " + license) }
                    DropdownMenu(expanded = showLicenses, onDismissRequest = { showLicenses = false }) {
                        listOf("original", "CC-BY", "CC-BY-SA", "public-domain", "institution-licensed").forEach { value ->
                            DropdownMenuItem(text = { Text(value) }, onClick = { license = value; showLicenses = false })
                        }
                    }
                }
                Text("Only add content the school has permission to use. Attribution and license are required.", style = MaterialTheme.typography.bodySmall)
                Button(
                    onClick = {
                        if (demoActive) demoSavedMessage = "Demo question draft saved locally. No school account or server was used."
                        else createQuestion(workspace.organizationId, grade, subject, curriculum, stem, answer, rubric, attribution, license)
                    },
                    enabled = (!busy || demoActive) && grade.isNotBlank() && subject.length >= 2 && curriculum.length >= 2 &&
                        stem.trim().length >= 10 && answer.trim().length >= 3 && attribution.trim().length >= 5,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                ) { Text("Save question draft") }

                Text("Assessment paper draft", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                OutlinedTextField(paperTitle, { paperTitle = it.take(180) }, label = { Text("Paper title") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(paperQuestionIds, { paperQuestionIds = it.take(400) }, label = { Text("Published question IDs, comma separated") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Button(
                    onClick = {
                        val ids = paperQuestionIds.split(",").mapNotNull { it.trim().toIntOrNull() }
                        if (demoActive) demoSavedMessage = "Demo paper draft saved locally. Its sample question set stays on this device."
                        else createPaper(workspace.organizationId, java.util.Calendar.getInstance().get(java.util.Calendar.YEAR),
                            grade, subject, curriculum, paperTitle, ids)
                    },
                    enabled = (!busy || demoActive) && paperTitle.trim().length >= 5 && paperQuestionIds.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                ) { Text("Save paper draft") }
            }

            Text("Assessment papers", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            if (workspace.papers.isEmpty()) Text("No paper drafts or published assessments yet.", style = MaterialTheme.typography.bodySmall)
            workspace.papers.forEach { paper ->
                val status = if (demoActive && paper.id == demoDraftPaperId && demoDraftPaperSubmitted) "submitted" else paper.status
                Text(paper.title, fontWeight = FontWeight.SemiBold)
                Text(paper.grade + " · " + paper.subject + " · " + paper.academicYear + " · " + paper.questionCount + " questions", style = MaterialTheme.typography.bodySmall)
                Text("Status · " + status.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.labelSmall)
                if (paper.status == "draft" && !demoDraftPaperSubmitted) {
                    OutlinedButton(
                        onClick = {
                            if (demoActive) { demoDraftPaperSubmitted = true; demoSavedMessage = "Demo paper submitted for independent review on this device." }
                            else decidePaper(workspace.organizationId, paper.id, "submit", "")
                        },
                        enabled = !busy || demoActive, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                    ) { Text("Submit paper for review") }
                }
                if (status == "submitted" && workspace.membershipRole in setOf("owner", "admin")) {
                    OutlinedTextField(note, { note = it.take(1000) }, label = { Text("Paper review note") }, modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { decidePaper(workspace.organizationId, paper.id, "approve", note) }, enabled = !busy) { Text("Approve paper") }
                        OutlinedButton(onClick = { decidePaper(workspace.organizationId, paper.id, "reject", note) }, enabled = !busy && note.isNotBlank()) { Text("Reject paper") }
                    }
                }
                if (paper.status == "approved" && workspace.membershipRole in setOf("owner", "admin")) {
                    Button(onClick = { decidePaper(workspace.organizationId, paper.id, "publish", "") }, enabled = !busy) { Text("Publish paper") }
                }
            }
        }
    }
}

@Composable
private fun SchoolOperationsCard(
    workspace: SchoolOperationsWorkspace,
    busy: Boolean,
    publishNotice: (Int, String, String, String) -> Unit,
    recordAttendance: (Int, String, String, String, String) -> Unit,
    substituteTeacher: (Int, Int, String, String) -> Unit
) {
    var subject by remember(workspace.organizationId) { mutableStateOf("") }
    var message by remember(workspace.organizationId) { mutableStateOf("") }
    var audience by remember(workspace.organizationId) { mutableStateOf("all") }
    var learnerId by remember(workspace.organizationId) { mutableStateOf("") }
    var day by remember(workspace.organizationId) { mutableStateOf(java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())) }
    var attendanceStatus by remember(workspace.organizationId) { mutableStateOf("present") }
    var attendanceNote by remember(workspace.organizationId) { mutableStateOf("") }
    var replacement by remember(workspace.organizationId) { mutableStateOf("") }
    var reason by remember(workspace.organizationId) { mutableStateOf("") }
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFFFFFEFA))) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(workspace.organizationName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("School membership · ${workspace.membershipRole.replace('_', ' ')}", style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
            workspace.notice?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            Text("Notices", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            if (workspace.notices.isEmpty()) Text("No notices available.", style = MaterialTheme.typography.bodySmall)
            workspace.notices.forEach { notice ->
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(notice.subject, fontWeight = FontWeight.SemiBold)
                    Text(notice.message, style = MaterialTheme.typography.bodyMedium)
                    Text("${notice.audience.replaceFirstChar { it.uppercase() }} · ${notice.createdAt.take(10)}", style = MaterialTheme.typography.labelSmall, color = Color(0xFF68736B))
                }
            }
            if (workspace.membershipRole == "learner") {
                Text("My attendance", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                if (workspace.attendance.isEmpty()) Text("No personal attendance entries yet.", style = MaterialTheme.typography.bodySmall)
                workspace.attendance.forEach { Text("${it.day} · ${it.status.replaceFirstChar { c -> c.uppercase() }}") }
            }
            if (workspace.canManage) {
                workspace.attendanceSummary?.let { summary ->
                    Text("Attendance overview · ${summary.year} · ${summary.records} records", fontWeight = FontWeight.SemiBold)
                    Text(summary.counts.entries.sortedBy { it.key }.joinToString("   ") { "${it.key}: ${it.value}" }, style = MaterialTheme.typography.bodySmall)
                }
            }
            Text("Timetable · ${java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            if (workspace.timetable.isEmpty()) Text("No timetable slots are published for this year.", style = MaterialTheme.typography.bodySmall)
            workspace.timetable.sortedWith(compareBy<SchoolTimetableSlot> { it.day }.thenBy { it.startsAt }).forEach { slot ->
                Text("Day ${slot.day} · ${slot.startsAt}–${slot.endsAt} · ${slot.subject} · ${slot.grade} ${slot.group} · ${slot.room}", style = MaterialTheme.typography.bodySmall)
                if (workspace.canManage && slot.status != "cancelled") {
                    OutlinedTextField(value = replacement, onValueChange = { replacement = it.take(160) },
                        label = { Text("Replacement teacher ID") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = reason, onValueChange = { reason = it.take(1000) },
                        label = { Text("Substitution reason") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedButton(onClick = { substituteTeacher(workspace.organizationId, slot.id, replacement, reason) },
                        enabled = !busy && replacement.isNotBlank() && reason.trim().length >= 5,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Assign substitute") }
                }
            }
            if (workspace.canManage) {
                Text("Publish notice", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                OutlinedTextField(value = subject, onValueChange = { subject = it.take(180) }, label = { Text("Notice title") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = message, onValueChange = { message = it.take(5000) }, label = { Text("Notice message") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("all", "learners", "staff").forEach { value ->
                        FilterChip(selected = audience == value, onClick = { audience = value }, label = { Text(value.replaceFirstChar { it.uppercase() }) }, enabled = !busy)
                    }
                }
                Button(onClick = { publishNotice(workspace.organizationId, subject, message, audience) },
                    enabled = !busy && subject.trim().length >= 3 && message.trim().length >= 10,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Publish to school") }
                Text("Record attendance", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                OutlinedTextField(value = learnerId, onValueChange = { learnerId = it.take(160) }, label = { Text("Learner account ID") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = day, onValueChange = { day = it.take(10) }, label = { Text("Date (YYYY-MM-DD)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("present", "absent", "late", "excused").forEach { value ->
                        FilterChip(selected = attendanceStatus == value, onClick = { attendanceStatus = value }, label = { Text(value.replaceFirstChar { it.uppercase() }) }, enabled = !busy)
                    }
                }
                OutlinedTextField(value = attendanceNote, onValueChange = { attendanceNote = it.take(1000) }, label = { Text("Optional note") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Button(onClick = { recordAttendance(workspace.organizationId, learnerId, day, attendanceStatus, attendanceNote) },
                    enabled = !busy && learnerId.isNotBlank() && day.matches(Regex("\\d{4}-\\d{2}-\\d{2}")),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Save attendance online") }
            }
        }
    }
}

@Composable
internal fun NotificationPreferencesCard(
    preferences: NotificationPreferences,
    busy: Boolean,
    update: (Int, String, Boolean, Boolean) -> Unit
) {
    var pending by remember { mutableStateOf<Pair<Int, String>?>(null) }
    var acknowledged by remember { mutableStateOf(false) }
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFFFFFEFA))) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Email preferences", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("Optional email updates about verified family access and assigned learner support. You can turn these off at any time.",
                style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
            if (!preferences.enabled) {
                Text("Preference controls are currently unavailable. You will not receive these optional updates.",
                    style = MaterialTheme.typography.bodyMedium)
            } else if (preferences.schools.isEmpty()) {
                Text("No school email preferences are available for this account.", style = MaterialTheme.typography.bodyMedium)
            } else preferences.schools.forEach { school ->
                Text(school.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                school.choices.forEach { choice ->
                    val label = when (choice.kind) {
                        "guardian_review_requested" -> "Family access review requests"
                        else -> "Updates to assigned learner support"
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        Switch(
                            checked = choice.enabled,
                            enabled = !busy && (choice.enabled || (preferences.optInAvailable && choice.canEnable)),
                            onCheckedChange = { enabled ->
                                if (!enabled && choice.enabled) update(school.id, choice.kind, false, false)
                                else if (enabled && !choice.enabled) {
                                    acknowledged = false
                                    pending = school.id to choice.kind
                                }
                            },
                            modifier = Modifier.testTag("notification-preference-${choice.kind}")
                        )
                    }
                    if (!choice.enabled && !choice.canEnable) {
                        Text("This former school preference can only be turned off.", style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF68736B))
                    } else if (!preferences.optInAvailable && !choice.enabled) {
                        Text("New opt-ins are temporarily unavailable.", style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF68736B))
                    }
                }
            }
        }
    }
    pending?.let { (organizationId, kind) ->
        AlertDialog(
            onDismissRequest = { pending = null; acknowledged = false },
            title = { Text("Confirm optional email updates") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("I agree to receive this school-related email. I understand this is optional and can be turned off at any time.")
                    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Checkbox(checked = acknowledged, onCheckedChange = { acknowledged = it }, enabled = !busy,
                            modifier = Modifier.testTag("notification-consent-acknowledgement"))
                        Text("I agree to receive these emails.")
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    pending = null
                    update(organizationId, kind, true, true)
                    acknowledged = false
                }, enabled = acknowledged && !busy) { Text("Confirm") }
            },
            dismissButton = {
                TextButton(onClick = { pending = null; acknowledged = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun TestLoginControls(
    username: String, password: String, busy: Boolean,
    onUsername: (String) -> Unit, onPassword: (String) -> Unit,
    submit: () -> Unit
) {
    Column(Modifier.fillMaxWidth().padding(top = 14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Isolated test account", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(value = username, onValueChange = onUsername,
            label = { Text("Test username") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(), enabled = !busy)
        OutlinedTextField(value = password, onValueChange = onPassword,
            label = { Text("Test password") }, singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(), enabled = !busy)
        Button(onClick = submit, enabled = !busy && username.isNotBlank() &&
            password.isNotBlank(), modifier = Modifier.heightIn(min = 48.dp)) {
            Text("Sign in to test environment")
        }
        Text("For a disposable dummy-data pilot only. School accounts use browser sign-in.",
            style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun SessionButtons(
    data: NativeLearning?, busy: Boolean, signIn: () -> Unit, refresh: () -> Unit,
    signOut: () -> Unit, isDemo: Boolean
) {
    if (data == null) {
        Button(onClick = signIn, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) {
            Text("Sign in securely")
        }
    } else {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = refresh, enabled = !busy, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) {
                Text(if (isDemo) "Reset demo" else "Refresh")
            }
            OutlinedButton(onClick = signOut, enabled = !busy, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) {
                Text(if (isDemo) "Exit demo" else "Sign out")
            }
        }
    }
}

@Composable
private fun RoleContent(
    modifier: Modifier,
    data: NativeLearning?,
    section: String,
    busy: Boolean,
    demoActive: Boolean,
    respondToInvite: (Int, Boolean) -> Unit,
    setNotificationPreference: (Int, String, Boolean, Boolean) -> Unit,
    reviewGuardian: (Int, Int, String) -> Unit,
    submitSchoolReport: (Int, String, Int) -> Unit,
    decideSchoolReport: (Int, Int, String, String) -> Unit,
    verifyIssuedReport: (IssuedSchoolReport) -> Unit,
    publishSchoolNotice: (Int, String, String, String) -> Unit,
    recordSchoolAttendance: (Int, String, String, String, String) -> Unit,
    substituteSchoolTeacher: (Int, Int, String, String) -> Unit,
    createAssessmentQuestion: (Int, String, String, String, String, String, String, String, String) -> Unit,
    decideAssessmentQuestion: (Int, Int, String, String) -> Unit,
    createAssessmentPaper: (Int, Int, String, String, String, String, List<Int>) -> Unit,
    decideAssessmentPaper: (Int, Int, String, String) -> Unit,
    createSupportRequest: () -> Unit,
    openSupportTicket: (SupportTicketSummary) -> Unit,
    openQuiz: (QuizSummary) -> Unit,
    openMaterial: (MaterialSummary) -> Unit,
    openWrittenExams: () -> Unit = {},
    pickMaterial: () -> Unit,
    openSupportDraft: (NativeSupportDraft) -> Unit,
    sendSupportDraft: (NativeSupportDraft) -> Unit,
    deleteSupportDraft: (NativeSupportDraft) -> Unit,
    learnerJourneyAction: (LearnerJourneyAction) -> Unit
) {
    LazyColumn(
        modifier.padding(horizontal = 16.dp).testTag("native-role-content"),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(bottom = 22.dp)
    ) {
        if (data == null) {
            item { NativeCard("A calmer way to stay connected", "Sign in to your own school or family space. Private records load only after CABO authorizes your account.") }
            return@LazyColumn
        }
        val role = data.portal.role
        if (section == "assessments") {
            item { Text("Assessment workspace", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
            items(data.assessmentWorkspaces, key = { "assessment-workspace-" + it.organizationId }) { workspace ->
                AssessmentWorkspaceCard(workspace, busy, demoActive, createAssessmentQuestion,
                    decideAssessmentQuestion, createAssessmentPaper, decideAssessmentPaper)
            }
            if (data.assessmentWorkspaces.isEmpty()) item { NativeCard("No assessment membership", "Question banks and assessment papers are limited to schools that authorize this account.") }
            return@LazyColumn
        }
        if (section == "school") {
            item { Text("School operations", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
            items(data.schoolOperations, key = { "school-operations:${it.organizationId}" }) { workspace ->
                SchoolOperationsCard(workspace, busy, publishSchoolNotice, recordSchoolAttendance, substituteSchoolTeacher)
            }
            if (data.schoolOperations.isEmpty()) item { NativeCard("No school membership", "Notices, attendance, and timetable details are available only through an institution that authorizes this account.") }
            return@LazyColumn
        }
        if (section == "home") {
            item {
                ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(
                    containerColor = Color(0xFFFFFEFA))) {
                    Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(when {
                            role == "teacher" || role == "assessor" -> "Your teaching desk"
                            role == "parent" -> "Learning grows together"
                            role == "superadmin" -> "Platform overview"
                            else -> "A place to learn. Room to grow."
                        }, style = MaterialTheme.typography.headlineSmall,
                            color = Color(0xFF29372F), fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold)
                        Text(when {
                            role == "teacher" || role == "assessor" -> "Prepare learning, support children and follow progress in one workspace."
                            role == "parent" -> "Stay connected to school updates and the progress shared with your family."
                            role == "superadmin" -> "Governance tools are read-only and never expose learner records."
                            else -> "Lessons, practice, support and progress come together in your CABO learning space."
                        }, style = MaterialTheme.typography.bodyLarge, color = Color(0xFF68736B))
                        Surface(color = Color(0xFFF3E6DA), shape = MaterialTheme.shapes.large) {
                            Text("${role.replace('_', ' ').uppercase()} SPACE",
                                Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                                color = Color(0xFFC4673A), style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                        }
                    }
                }
            }
            if (data.portal.summary.isNotEmpty()) {
                item { Text("At a glance", style = MaterialTheme.typography.titleMedium, color = Color(0xFF29372F)) }
                items(data.portal.summary.take(3)) { metric ->
                    NativeCard(metric, when(role) {
                        "teacher", "assessor" -> "Your authorised school workspace"
                        "parent" -> "Family account overview"
                        else -> "Your CABO learning account"
                    })
                }
            }
            item {
                NativeCard("Choose a space below", when(role) {
                    "teacher", "assessor" -> "Open Support for assigned learner requests, or Progress for school-level support totals."
                    "parent" -> "Open Support for invitations and Progress for school-verified reports."
                    else -> "Open Learn for study material and practice, or Progress to review your reports."
                })
            }
        } else if (role == "superadmin") {
            item { Text("Platform governance", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
            item { NativeCard("Read-only organisation registry", "Private learner records remain restricted in this workspace.") }
            items(data.adminOrganizations) { name -> NativeCard(name, "Registered organisation") }
            if (data.adminOrganizations.isEmpty()) item { NativeCard("No organisations", "No registered organisations to display.") }
        } else if (section == "learn") {
            when (role) {
                "teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head" -> {
                    item { Text("Assigned subjects", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    data.staff.forEach { workspace ->
                        if (workspace.notice != null) item { NativeCard("Workspace unavailable", workspace.notice) }
                        workspace.courses.forEach { course -> item { NativeCard(course, "Assigned school subject") } }
                    }
                    if (data.staff.all { it.courses.isEmpty() }) item { NativeCard("No subjects assigned", "Ask your school administrator to check your staff and course assignments.") }
                }
                "parent" -> {
                    item { Text("Family learning", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    item { NativeCard("Learning together", "Use the verified progress section to discuss goals with the learner and their school.") }
                }
                else -> {
                    item { Text("Study materials", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    if (role == "learner" && !demoActive) {
                        item {
                            OutlinedButton(onClick = pickMaterial, enabled = !busy,
                                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                                Text("Add material from this device")
                            }
                        }
                    }
                    if (data.materialEntries.isEmpty()) item { NativeCard("No materials yet", "Your school has not shared study materials with this account.") }
                    items(data.materialEntries, key = { "material:${it.id}" }) { material ->
                        ElevatedCard(onClick = { openMaterial(material) }, modifier = Modifier.fillMaxWidth(), enabled = !busy) {
                            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(material.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Text("Open reading", style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
                            }
                        }
                    }
                    item { Text("Written exams", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    item {
                        OutlinedButton(onClick = openWrittenExams, enabled = !busy,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                            Text(if (data.canManageExamAssignments) "Manage written exam assignments" else "Create or take a written exam")
                        }
                    }
                    if (data.writtenExams.isNotEmpty()) {
                        item { Text("Your written exams", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold) }
                        items(data.writtenExams, key = { "written-exam:${it.id}" }) { exam ->
                            NativeCard(exam.title, "${exam.questions.size} questions · ${exam.difficulty}")
                        }
                    }
                    item { Text("Practice", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    if (data.quizEntries.isEmpty()) item { NativeCard("No practice tests yet", "New practice activities will appear here when assigned.") }
                    items(data.quizEntries, key = { "quiz:${it.id}" }) { quiz ->
                        ElevatedCard(onClick = { openQuiz(quiz) }, modifier = Modifier.fillMaxWidth(), enabled = !busy) {
                            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(quiz.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Text("${quiz.questionCount} questions", style = MaterialTheme.typography.bodySmall)
                                quiz.latestScore?.let { Text("Previous practice: $it%", color = Color(0xFFC4673A)) }
                            }
                        }
                    }
                }
            }
        } else if (section == "progress") {
            when (role) {
                "parent" -> {
                    item { Text("School-verified progress", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    if (data.parentReportNotice.isNotBlank()) item { Text(data.parentReportNotice, style = MaterialTheme.typography.bodySmall) }
                    if (data.parentReports.isEmpty()) item { NativeCard("No verified reports", "Only a school-verified guardian of an actively enrolled learner can view academic progress.") }
                    items(data.parentReports, key = { it.id }) { report ->
                        ReportCard(report.learnerName, report.grade, report.year, report.average,
                            report.subjects, report.attendanceRate, report.presentDays, report.recordedDays,
                            "School-verified preview · not an official report card")
                    }
                    item { Text("School-issued reports", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    if (data.issuedReports.isEmpty()) item { NativeCard("No issued reports available", "A verified guardian can view school-issued reports after the school publishes them.") }
                    items(data.issuedReports, key = { "parent-issued:${it.key}" }) { report ->
                        IssuedReportCard(report, data.issuedReportIntegrity[report.key], busy) { verifyIssuedReport(report) }
                    }
                }
                "teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head" -> {
                    item { Text("Support outcomes", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    item { Text("School-wide totals describe authorised requests; they are not a teacher ranking.", style = MaterialTheme.typography.bodyMedium) }
                    data.staff.forEach { workspace ->
                        workspace.supportSummary.forEach { metric -> item { NativeCard(metric, "Current school support activity") } }
                    }
                }
                else -> {
                    item { Text("Your progress", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    data.journey.forEach { milestone -> item { NativeCard(milestone, "Learning journey") } }
                    item { LearnerJourneyPanel(data, busy, learnerJourneyAction) }
                    item {
                        OutlinedButton(onClick = openLearnerPassport, enabled = !busy,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                            Text("Open my learner passport")
                        }
                    }
                    if (data.learnerReportNotice.isNotBlank()) item { Text(data.learnerReportNotice) }
                    if (data.learnerReports.isEmpty()) item { NativeCard("No report preview", "A verified enrolment and published assessments are required.") }
                    items(data.learnerReports, key = { it.id }) { report ->
                        ReportCard("My report", report.grade, report.year, report.average,
                            report.subjects, report.attendanceRate, report.presentDays, report.recordedDays,
                            "Learner preview · not an officially issued report card")
                    }
                    item { Text("School-issued reports", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    if (data.issuedReports.isEmpty()) item { NativeCard("No issued reports yet", "A school-issued report will appear here after the institution completes its review.") }
                    items(data.issuedReports, key = { "learner-issued:${it.key}" }) { report ->
                        IssuedReportCard(report, data.issuedReportIntegrity[report.key], busy) { verifyIssuedReport(report) }
                    }
                }
            }
        } else {
            when (role) {
                "parent" -> {
                    item { Text("Family invitations", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    if (data.parentGuidance.isNotBlank()) item { Text(data.parentGuidance, style = MaterialTheme.typography.bodySmall) }
                    if (data.guardians.isEmpty()) item { NativeCard("No invitations", "A learner can invite you through their CABO account.") }
                    items(data.guardians, key = { "invite:${it.id}" }) { invite ->
                        ElevatedCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(invite.learnerName ?: "Private learner invitation", style = MaterialTheme.typography.titleMedium)
                                Text(when(invite.status) {
                                    "pending" -> "Waiting for your response"
                                    "accepted" -> "Accepted · school verification pending"
                                    "verified" -> if (invite.verified) "Verified guardian connection" else "School enrolment needs confirmation"
                                    "revoked" -> "Connection revoked"
                                    else -> "Status: ${invite.status}"
                                }, color = Color(0xFF68736B))
                                if (invite.status == "pending") Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Button(onClick = { respondToInvite(invite.id, true) }, enabled = !busy,
                                        modifier = Modifier.heightIn(min = 48.dp)) { Text("Accept invitation") }
                                    OutlinedButton(onClick = { respondToInvite(invite.id, false) }, enabled = !busy,
                                        modifier = Modifier.heightIn(min = 48.dp)) { Text("Decline") }
                                }
                            }
                        }
                    }
                    item { NotificationPreferencesCard(data.notificationPreferences, busy, setNotificationPreference) }
                }
                "teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head" -> {
                    item { Text("Learner support queue", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    item { Text("Requests shown here are limited to subjects assigned to your account.", style = MaterialTheme.typography.bodyMedium) }
                    data.guardianReviewWorkspaces.forEach { workspace ->
                        item(key = "guardian-review-title:${workspace.organizationId}") {
                            Text("Family access review · school ${workspace.organizationId}",
                                style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        }
                        item(key = "guardian-review-guidance:${workspace.organizationId}") {
                            Text("Confirm legal authority using your school's safeguarding process. CABO does not collect or upload identity documents here.",
                                style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
                        }
                        if (workspace.reviews.isEmpty()) item(key = "guardian-review-empty:${workspace.organizationId}") {
                            NativeCard("No family reviews awaiting action", "Accepted family invitations will appear here when they need school verification.")
                        }
                        workspace.reviews.forEach { review ->
                            item(key = "guardian-review:${workspace.organizationId}:${review.id}") {
                                var evidenceReviewed by remember(data, workspace.organizationId, review.id) { mutableStateOf(false) }
                                ElevatedCard(Modifier.fillMaxWidth()) {
                                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Text("Guardian relationship ${review.id}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                        Text("Learner ${review.learnerId} · guardian ${review.guardianId}", style = MaterialTheme.typography.bodySmall)
                                        Text("${review.status.replace('_', ' ')} · school review required",
                                            style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
                                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                                            Checkbox(
                                                checked = evidenceReviewed,
                                                onCheckedChange = { evidenceReviewed = it },
                                                enabled = !busy,
                                                modifier = Modifier.testTag("guardian-evidence-confirmation")
                                            )
                                            Text("I independently reviewed legal authority", style = MaterialTheme.typography.bodySmall)
                                        }
                                        when (review.status) {
                                            "accepted" -> Button(onClick = { reviewGuardian(workspace.organizationId, review.id, "verified") },
                                                enabled = evidenceReviewed && !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                                                Text("Verify guardian access")
                                            }
                                            "verified" -> OutlinedButton(onClick = { reviewGuardian(workspace.organizationId, review.id, "revoked") },
                                                enabled = evidenceReviewed && !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                                                Text("Revoke guardian access")
                                            }
                                            else -> Text("This relationship cannot be changed from its current status.", style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    data.reportIssuanceWorkspaces.forEach { workspace ->
                        item(key = "report-issuance-title:${workspace.organizationId}") {
                            Text("School report workflow · school ${workspace.organizationId}",
                                style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        }
                        item(key = "report-issuance-guidance:${workspace.organizationId}") {
                            Text("Reports are snapshots of published assessments. Approval must come from a different authorised school administrator; issue only after reviewing the snapshot and integrity status.",
                                style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
                        }
                        item(key = "report-issuance-create:${workspace.organizationId}") {
                            var learnerId by remember(data, workspace.organizationId) { mutableStateOf("") }
                            var year by remember(data, workspace.organizationId) {
                                mutableStateOf(java.util.Calendar.getInstance().get(java.util.Calendar.YEAR).toString())
                            }
                            val parsedYear = year.toIntOrNull()
                            ElevatedCard(Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Text("Prepare a report", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                    OutlinedTextField(value = learnerId, onValueChange = { learnerId = it.take(200) },
                                        label = { Text("Enrolled learner account ID") }, singleLine = true,
                                        modifier = Modifier.fillMaxWidth(), enabled = !busy)
                                    OutlinedTextField(value = year, onValueChange = { year = it.filter { char -> char.isDigit() }.take(4) },
                                        label = { Text("Academic year") }, singleLine = true,
                                        modifier = Modifier.fillMaxWidth(), enabled = !busy)
                                    Button(onClick = { parsedYear?.let { submitSchoolReport(workspace.organizationId, learnerId, it) } },
                                        enabled = !busy && learnerId.isNotBlank() && parsedYear != null && parsedYear in 2000..2200,
                                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                                        Text("Submit report for review")
                                    }
                                }
                            }
                        }
                        if (workspace.records.isEmpty()) item(key = "report-issuance-empty:${workspace.organizationId}") {
                            NativeCard("No report versions", "Submitted school reports will appear here for independent review.")
                        }
                        workspace.records.forEach { report ->
                            item(key = "report-issuance:${workspace.organizationId}:${report.id}") {
                                var reason by remember(data, workspace.organizationId, report.id) { mutableStateOf("") }
                                ElevatedCard(Modifier.fillMaxWidth()) {
                                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Text("Learner ${report.learnerId}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                        Text("${report.academicYear} · version ${report.version} · ${report.status.replace('_', ' ')}",
                                            style = MaterialTheme.typography.bodySmall)
                                        Text("SHA-256 ${report.contentHash.take(24)}…", style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF68736B))
                                        if (report.reviewedBy != null) Text("Independent reviewer recorded", style = MaterialTheme.typography.bodySmall)
                                        if (report.status in setOf("submitted", "issued")) {
                                            OutlinedTextField(value = reason, onValueChange = { reason = it.take(1000) },
                                                label = { Text("Reason for rejection or revocation") },
                                                modifier = Modifier.fillMaxWidth().testTag("report-reason-${report.id}"), enabled = !busy)
                                        }
                                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                            when (report.status) {
                                                "submitted" -> {
                                                    OutlinedButton(onClick = { decideSchoolReport(workspace.organizationId, report.id, "reject", reason) },
                                                        enabled = !busy && reason.isNotBlank()) { Text("Reject") }
                                                    Button(onClick = { decideSchoolReport(workspace.organizationId, report.id, "approve", "") },
                                                        enabled = !busy) { Text("Approve") }
                                                }
                                                "approved" -> Button(onClick = { decideSchoolReport(workspace.organizationId, report.id, "issue", "") },
                                                    enabled = !busy) { Text("Issue report") }
                                                "issued" -> OutlinedButton(onClick = { decideSchoolReport(workspace.organizationId, report.id, "revoke", reason) },
                                                    enabled = !busy && reason.isNotBlank()) { Text("Revoke") }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (data.staff.isEmpty() || data.staff.all { it.tickets.isEmpty() })
                        item { NativeCard("No requests to show", data.staff.firstOrNull()?.notice ?: "New support requests for your assigned subjects will appear here.") }
                    data.staff.forEach { workspace ->
                        workspace.tickets.forEach { ticket ->
                            item(key = "ticket:${workspace.organizationId}:${ticket.id}") {
                                ElevatedCard(onClick = { openSupportTicket(ticket) },
                                    modifier = Modifier.fillMaxWidth(), enabled = !busy) {
                                    Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Text(ticket.concept, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                        Text("${ticket.status.replace('_', ' ')} · request ${ticket.id}", style = MaterialTheme.typography.bodySmall)
                                        Text("Review request  ›", style = MaterialTheme.typography.labelLarge, color = Color(0xFFC4673A))
                                    }
                                }
                            }
                        }
                    }
                }
                else -> {
                    item { Text("My support", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    if (data.supportDrafts.isNotEmpty()) {
                        item { Text("Saved drafts", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold) }
                        items(data.supportDrafts, key = { "support-draft:${it.requestKey}" }) { draft ->
                            ElevatedCard(Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(draft.concept, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                    Text("${draft.courseName} · saved on this device", style = MaterialTheme.typography.bodySmall)
                                    Button(onClick = { sendSupportDraft(draft) }, enabled = !busy,
                                        modifier = Modifier.fillMaxWidth()) { Text("Retry sending") }
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        OutlinedButton(onClick = { openSupportDraft(draft) }, enabled = !busy) { Text("Edit") }
                                        TextButton(onClick = { deleteSupportDraft(draft) }, enabled = !busy) { Text("Delete") }
                                    }
                                }
                            }
                        }
                    }
                    if (data.learnerSupportTickets.isEmpty()) item { NativeCard("No open requests", "When you ask your school for help, updates will appear here.") }
                    items(data.learnerSupportTickets, key = { "learner-ticket:${it.organizationId}:${it.id}" }) { ticket ->
                        ElevatedCard(onClick = { openSupportTicket(ticket) }, modifier = Modifier.fillMaxWidth(), enabled = !busy) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(ticket.concept, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Text("${ticket.status.replace('_', ' ')} · request ${ticket.id}", style = MaterialTheme.typography.bodySmall)
                                ticket.reviewAt?.let { Text("Practice review · $it", style = MaterialTheme.typography.bodySmall) }
                                Text("View request and reply  ›", style = MaterialTheme.typography.labelLarge, color = Color(0xFFC4673A))
                            }
                        }
                    }
                    if (demoActive) item {
                        Button(onClick = createSupportRequest, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                            Text("Ask your educator for help")
                        }
                    } else if (data.supportCourses.isNotEmpty()) item {
                        Button(onClick = createSupportRequest, enabled = !busy,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                            Text("Ask your educator for help")
                        }
                    } else item {
                        NativeCard("Need help with a topic?", "Create a support request from the CABO learner workspace. Native request creation is not enabled in this build.")
                    }
                }
            }
        }
        item { Text("CABO protects account access. Sample and preview information is not an official record.",
            style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B), modifier = Modifier.padding(top = 8.dp)) }
    }
}

@Composable
private fun LearnerJourneyPanel(
    data: NativeLearning,
    busy: Boolean,
    onAction: (LearnerJourneyAction) -> Unit
) {
    var displayName by remember(data.journeyIdentity.displayName) { mutableStateOf(data.journeyIdentity.displayName) }
    var institution by remember { mutableStateOf("") }
    var stage by remember { mutableStateOf("RR") }
    var entryYear by remember { mutableIntStateOf(java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)) }
    var note by remember { mutableStateOf("") }
    var milestoneTitle by remember { mutableStateOf("") }
    var milestoneDetail by remember { mutableStateOf("") }
    var milestoneKind by remember { mutableStateOf("project") }
    var milestoneYear by remember { mutableIntStateOf(java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)) }
    var expanded by remember { mutableStateOf(false) }
    val stages = listOf("RR", "R") + (1..12).map { it.toString() } + listOf("university", "college", "training", "professional")
    val kinds = listOf("academic", "project", "community", "creative", "technical", "personal_growth", "other")
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFFFFFEFA))) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("My learning journey", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("A private, self-reported record. These entries are not verified school records and are never shared automatically.",
                style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
            OutlinedTextField(displayName, { displayName = it.take(160) }, label = { Text("Preferred display name") },
                modifier = Modifier.fillMaxWidth(), enabled = !busy, singleLine = true)
            Button(onClick = { onAction(LearnerJourneyAction.SaveIdentity(displayName)) }, enabled = !busy,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Save identity") }
            Divider()
            Text("Education timeline", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            if (data.journeyEntries.isEmpty()) Text("Add your first learning stage.", color = Color(0xFF68736B))
            data.journeyEntries.forEach { entry ->
                Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("${entry.academicYear} · ${if (entry.stage in listOf("RR", "R") || entry.stage.toIntOrNull() != null) "Grade ${entry.stage}" else entry.stage.replaceFirstChar { it.uppercase() }}",
                        fontWeight = FontWeight.SemiBold)
                    Text(entry.institutionName)
                    if (entry.note.isNotBlank()) Text(entry.note, style = MaterialTheme.typography.bodySmall)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Self-reported", style = MaterialTheme.typography.labelSmall, color = Color(0xFF68736B))
                        TextButton(onClick = { onAction(LearnerJourneyAction.DeleteEntry(entry.id)) }, enabled = !busy) { Text("Remove") }
                    }
                }
            }
            OutlinedTextField(institution, { institution = it.take(160) }, label = { Text("School or institution") },
                modifier = Modifier.fillMaxWidth(), enabled = !busy, singleLine = true)
            Box {
                OutlinedButton(onClick = { expanded = true }, enabled = !busy) { Text("Stage: ${stageLabel(stage)}") }
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    stages.forEach { option -> DropdownMenuItem(text = { Text(stageLabel(option)) }, onClick = { stage = option; expanded = false }) }
                }
            }
            OutlinedTextField(entryYear.toString(), { value -> value.toIntOrNull()?.let { entryYear = it.coerceIn(1900, 2200) } },
                label = { Text("Year") }, modifier = Modifier.fillMaxWidth(), enabled = !busy, singleLine = true)
            OutlinedTextField(note, { note = it.take(2000) }, label = { Text("What changed or stood out? (optional)") },
                modifier = Modifier.fillMaxWidth(), enabled = !busy, minLines = 2, maxLines = 5)
            Button(onClick = { onAction(LearnerJourneyAction.AddEntry(institution, stage, entryYear, note)) },
                enabled = !busy && institution.trim().length >= 2, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Text("Add learning stage")
            }
            Divider()
            Text("Development milestones", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            if (data.journeyMilestones.isEmpty()) Text("Record an achievement or moment of growth when you are ready.", color = Color(0xFF68736B))
            data.journeyMilestones.forEach { item ->
                Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("${item.year} · ${item.title}", fontWeight = FontWeight.SemiBold)
                    Text("${item.kind.replace('_', ' ').replaceFirstChar { it.uppercase() }} · Self-reported", style = MaterialTheme.typography.labelSmall)
                    Text(item.description, style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = { onAction(LearnerJourneyAction.DeleteMilestone(item.id)) }, enabled = !busy) { Text("Remove") }
                }
            }
            OutlinedTextField(milestoneTitle, { milestoneTitle = it.take(160) }, label = { Text("Milestone title") },
                modifier = Modifier.fillMaxWidth(), enabled = !busy, singleLine = true)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                kinds.forEach { kind -> FilterChip(selected = milestoneKind == kind, onClick = { milestoneKind = kind },
                    label = { Text(kind.replace('_', ' ')) }, enabled = !busy) }
            }
            OutlinedTextField(milestoneYear.toString(), { value -> value.toIntOrNull()?.let { milestoneYear = it.coerceIn(1900, 2200) } },
                label = { Text("Year") }, modifier = Modifier.fillMaxWidth(), enabled = !busy, singleLine = true)
            OutlinedTextField(milestoneDetail, { milestoneDetail = it.take(4000) }, label = { Text("What did you achieve, develop or learn?") },
                modifier = Modifier.fillMaxWidth(), enabled = !busy, minLines = 3, maxLines = 7)
            Button(onClick = { onAction(LearnerJourneyAction.AddMilestone(milestoneTitle, milestoneDetail, milestoneKind, milestoneYear)) },
                enabled = !busy && milestoneTitle.trim().length >= 2 && milestoneDetail.trim().length >= 10,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Add milestone") }
        }
    }
}

private fun stageLabel(value: String) = if (value in listOf("RR", "R") || value.toIntOrNull() != null) "Grade $value" else value.replaceFirstChar { it.uppercase() }

@Composable
private fun ReportCard(
    title: String, grade: String, year: Int, average: Double?,
    subjects: List<GuardianSubject>, attendanceRate: Int?, presentDays: Int,
    recordedDays: Int, note: String
) {
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFFFFFEFA))) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("$grade · $year", color = Color(0xFF68736B))
            average?.let { Text("Average  $it%", style = MaterialTheme.typography.headlineSmall, color = Color(0xFFC4673A)) }
            if (subjects.isNotEmpty()) {
                HorizontalDivider()
                subjects.forEach { subject ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(subject.name, modifier = Modifier.weight(1f))
                        Text("${subject.percentage}%", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            attendanceRate?.let { Text("Attendance  $it% · $presentDays of $recordedDays days") }
            Text(note, style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
        }
    }
}

@Composable
private fun IssuedReportCard(
    report: IssuedSchoolReport,
    integrity: ReportIntegrityCheck?,
    busy: Boolean,
    verify: () -> Unit
) {
    val learnerLabel = report.learnerName?.takeIf { it.isNotBlank() }?.let { "$it · " } ?: ""
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFFFFFEFA))) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text("${learnerLabel}Grade ${report.snapshot.grade} · ${report.academicYear}",
                style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            report.snapshot.average?.let { Text("Published average · $it%", style = MaterialTheme.typography.headlineSmall, color = Color(0xFFC4673A)) }
            report.snapshot.subjects.forEach { subject ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(subject.name, modifier = Modifier.weight(1f))
                    Text("${subject.percentage}%", fontWeight = FontWeight.SemiBold)
                }
            }
            report.snapshot.attendanceRate?.let {
                Text("Attendance · $it% · ${report.snapshot.presentDays} of ${report.snapshot.recordedDays} days")
            }
            Text("School-issued pilot record · not a digitally signed or accredited certificate.",
                style = MaterialTheme.typography.bodySmall, color = Color(0xFF68736B))
            Text("SHA-256 ${report.contentHash}", style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF68736B))
            OutlinedButton(onClick = verify, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Text(if (integrity == null) "Check report integrity" else "Check integrity again")
            }
            integrity?.let { result ->
                val message = when {
                    result.hashValid == null -> "Legacy digest · cannot verify stored content."
                    !result.hashValid -> "Warning · report content hash mismatch."
                    result.signatureValid -> "Signature verified. Issuer accreditation is not asserted."
                    result.cryptographicallySigned -> "Signature present but not trusted or not valid."
                    else -> "Content integrity checked. No cryptographic signature configured."
                }
                Text(message, style = MaterialTheme.typography.bodySmall, color = if (result.hashValid == false) Color(0xFF9F302A) else Color(0xFF68736B))
            }
        }
    }
}

@Composable
private fun NativeCard(title: String, subtitle: String) {
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(
        containerColor = Color(0xFFFFFEFA))) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium,
                color = Color(0xFF29372F), fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF68736B))
        }
    }
}

