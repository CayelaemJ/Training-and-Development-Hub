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
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.School
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
                primary = Color(0xFF14635D), onPrimary = Color.White,
                secondary = Color(0xFFC66B43), onSecondary = Color.White,
                background = Color(0xFFF4F5F1), surface = Color(0xFFFFFEFA),
                surfaceVariant = Color(0xFFE6EFEB), onSurface = Color(0xFF1F302E),
                onSurfaceVariant = Color(0xFF53625F), outline = Color(0xFFD0D9D5)
            )
            MaterialTheme(colorScheme = caboColors) {
                BackHandler(enabled = selectedUploadUri != null || creatingSupportRequest || selectedSupportTicket != null || selectedQuiz != null || selectedMaterial != null) {
                    when {
                        selectedUploadUri != null -> closeMaterialUpload()
                        creatingSupportRequest -> creatingSupportRequest = false
                        selectedSupportTicket != null -> closeSupportTicket()
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
                        close = { closeSupportTicket() }
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
                        openSupportTicket = { openSupportTicket(it) },
                        openQuiz = { openQuiz(it) },
                        openMaterial = { openMaterial(it) },
                        pickMaterial = { if (!demoActive) materialPicker.launch(arrayOf("*/*")) },
                        openSupportDraft = { draft -> selectedSupportDraft = draft; supportFormMessage = null; creatingSupportRequest = true },
                        sendSupportDraft = { sendSupportDraft(it) },
                        deleteSupportDraft = { deleteSupportDraft(it) },
                        offlineSupportDrafts = supportDrafts,
                        offlineSupportCourses = supportCourseOptions
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
        status = "DEMO MODE · sample data only · no account connected"
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
        status = "DEMO MODE · ${role.uppercase()} preview · synthetic records"
    }

    private fun createDemoSupportRequest(concept: String, question: String, attempted: String) {
        if (!demoActive || concept.trim().length < 2 || question.trim().length < 10 || attempted.trim().length < 3) return
        NativeDemoSession.createRequest(concept, question, attempted)
        screen = NativeDemoData.learner()
        creatingSupportRequest = false
        status = "Demo request created locally. Switch to Educator to review it."
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
            current.copy(staff = current.staff.map { workspace ->
                if (workspace.organizationId != summary.organizationId) workspace else workspace.copy(
                    tickets = workspace.tickets.map { if (it.id == summary.id) summary else it }
                )
            })
        }
    }

    private fun draftSupportGuidance() {
        val summary = supportTicket?.summary ?: return
        if (supportBusy) return
        if (demoActive) {
            supportGuidance = SupportGuidanceDraft(
                explanation = "To add fractions with different denominators, rewrite them as equivalent fractions with the same denominator. For thirds and fourths, twelfths work because 12 is a multiple of both 3 and 4.",
                questions = listOf("How many twelfths are equal to one third?", "How many twelfths are equal to one quarter?"),
                practice = listOf("Rewrite 1/3 and 1/4 in twelfths.", "Add the numerators and keep the denominator."),
                source = "non_ai_template"
            )
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
    openSupportTicket: (SupportTicketSummary) -> Unit,
    openQuiz: (QuizSummary) -> Unit,
    openMaterial: (MaterialSummary) -> Unit,
    pickMaterial: () -> Unit,
    openSupportDraft: (NativeSupportDraft) -> Unit = {},
    sendSupportDraft: (NativeSupportDraft) -> Unit = {},
    deleteSupportDraft: (NativeSupportDraft) -> Unit = {},
    offlineSupportDrafts: List<NativeSupportDraft> = emptyList(),
    offlineSupportCourses: List<SupportCourseOption> = emptyList()
) {
    var section by remember(demoRole) { mutableStateOf("home") }
    val sections = listOf(
        Triple("home", "Home", Icons.Default.Home),
        Triple("learn", "Learn", Icons.Default.School),
        Triple("progress", "Progress", Icons.Default.Assessment),
        Triple("support", "Support", Icons.Default.Forum)
    )
    Scaffold(
        containerColor = Color(0xFFF4F5F1),
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("CABO", color = Color(0xFFBFE5D6), fontSize = 12.sp,
                            fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                        Text("Learning Hub", color = Color.White,
                            style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    }
                },
                navigationIcon = {
                    Surface(
                        color = Color(0xFF2A746D), shape = MaterialTheme.shapes.large,
                        modifier = Modifier.padding(start = 16.dp).size(40.dp)
                    ) {
                        Box(contentAlignment = androidx.compose.ui.Alignment.Center) {
                            Text("C", color = Color.White, fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.titleLarge)
                        }
                    }
                },
                actions = {
                    if (data != null) {
                        IconButton(onClick = refresh, enabled = !busy) {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh dashboard", tint = Color.White)
                        }
                        IconButton(onClick = signOut, enabled = !busy) {
                            Icon(Icons.Default.Logout, contentDescription = if (demoActive) "Exit demo" else "Sign out", tint = Color.White)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF153B38))
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
                                selectedIconColor = Color(0xFF14635D),
                                selectedTextColor = Color(0xFF14635D),
                                indicatorColor = Color(0xFFD9ECE4)
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
                    Text("Learning that moves with you", style = MaterialTheme.typography.headlineMedium,
                        color = Color(0xFF153B38), fontWeight = FontWeight.Bold)
                    Text("A secure space for learners, families and educators to stay connected to progress.",
                        style = MaterialTheme.typography.bodyLarge, color = Color(0xFF53625F))
                    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(
                        containerColor = Color(0xFFFFFEFA))) {
                        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(status, color = if (busy) MaterialTheme.colorScheme.primary else Color(0xFF53625F))
                            SessionButtons(data, busy, signIn, refresh, signOut, isDemo = false)
                            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                            if (testLoginAvailable) TestLoginControls(testUsername, testPassword, busy,
                                onTestUsername, onTestPassword, signInTest)
                        }
                    }
                    if (demoEnabled) {
                        OutlinedButton(onClick = startDemo, modifier = Modifier.fillMaxWidth().heightIn(min = 54.dp)) {
                            Text("Explore the interactive demo", fontWeight = FontWeight.SemiBold)
                        }
                        Text("Fictional sample records · works without an account or network · no data is sent",
                            style = MaterialTheme.typography.bodySmall, color = Color(0xFF53625F))
                    }
                    if (offlineSupportDrafts.isNotEmpty()) {
                        ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(
                            containerColor = Color(0xFFE6EFEB))) {
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
                        color = Color(0xFF14635D), letterSpacing = 1.2.sp)
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
                                "support" -> "Support & connection"
                                else -> "Welcome back"
                            }, style = MaterialTheme.typography.titleLarge, color = Color(0xFF153B38),
                                fontWeight = FontWeight.Bold)
                            Text(status, style = MaterialTheme.typography.bodySmall, color = Color(0xFF53625F))
                        }
                        if (busy) CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                    }
                    if (demoActive) {
                        ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(
                            containerColor = Color(0xFFE5F1E8))) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("DEMO MODE · synthetic records only", style = MaterialTheme.typography.labelLarge,
                                    color = Color(0xFF14554F), fontWeight = FontWeight.Bold)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf("learner" to "Learner", "teacher" to "Educator", "parent" to "Guardian").forEach { (role, label) ->
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
                                Text("YOUR SPACE", color = Color(0xFF14635D),
                                    style = MaterialTheme.typography.labelLarge, letterSpacing = 1.2.sp)
                                Text(data.portal.role.replace('_', ' ').replaceFirstChar { it.uppercase() },
                                    style = MaterialTheme.typography.headlineSmall, color = Color(0xFF153B38),
                                    fontWeight = FontWeight.Bold)
                                data.portal.summary.take(3).forEach { metric ->
                                    NativeCard(metric, "Current account summary")
                                }
                                Text("Use the sections below to move between learning, progress and support.",
                                    style = MaterialTheme.typography.bodySmall, color = Color(0xFF53625F))
                            }
                            RoleContent(
                                modifier = Modifier.weight(1f).fillMaxHeight(), data = data,
                                section = section, busy = busy, demoActive = demoActive,
                                respondToInvite = respondToInvite, createSupportRequest = createSupportRequest,
                                openSupportTicket = openSupportTicket, openQuiz = openQuiz, openMaterial = openMaterial,
                                pickMaterial = pickMaterial, openSupportDraft = openSupportDraft,
                                sendSupportDraft = sendSupportDraft, deleteSupportDraft = deleteSupportDraft
                            )
                        }
                    } else {
                        RoleContent(
                            modifier = Modifier.fillMaxSize(), data = data, section = section, busy = busy,
                            demoActive = demoActive, respondToInvite = respondToInvite,
                            createSupportRequest = createSupportRequest, openSupportTicket = openSupportTicket,
                            openQuiz = openQuiz, openMaterial = openMaterial, pickMaterial = pickMaterial,
                            openSupportDraft = openSupportDraft, sendSupportDraft = sendSupportDraft,
                            deleteSupportDraft = deleteSupportDraft
                        )
                    }
                }
            }
        }
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
    createSupportRequest: () -> Unit,
    openSupportTicket: (SupportTicketSummary) -> Unit,
    openQuiz: (QuizSummary) -> Unit,
    openMaterial: (MaterialSummary) -> Unit,
    pickMaterial: () -> Unit,
    openSupportDraft: (NativeSupportDraft) -> Unit,
    sendSupportDraft: (NativeSupportDraft) -> Unit,
    deleteSupportDraft: (NativeSupportDraft) -> Unit
) {
    LazyColumn(
        modifier.padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(bottom = 22.dp)
    ) {
        if (data == null) {
            item { NativeCard("A calmer way to stay connected", "Sign in to your own school or family space. Private records load only after CABO authorizes your account.") }
            return@LazyColumn
        }
        val role = data.portal.role
        if (section == "home") {
            item {
                ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(
                    containerColor = Color(0xFF153B38))) {
                    Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(when {
                            role == "teacher" || role == "assessor" -> "Make every next step count"
                            role == "parent" -> "Stay close to their progress"
                            role == "superadmin" -> "Platform overview"
                            else -> "Small steps. Real progress."
                        }, style = MaterialTheme.typography.headlineSmall,
                            color = Color.White, fontWeight = FontWeight.Bold)
                        Text(when {
                            role == "teacher" || role == "assessor" -> "Your assigned classes and support requests, together."
                            role == "parent" -> "School-verified information, clearly separated from draft records."
                            role == "superadmin" -> "Governance tools are read-only and never expose learner records."
                            else -> "Pick up your learning with resources, practice and progress in one space."
                        }, style = MaterialTheme.typography.bodyLarge, color = Color(0xFFD8E9E3))
                        Surface(color = Color(0xFF2B615A), shape = MaterialTheme.shapes.large) {
                            Text("${role.replace('_', ' ').uppercase()} SPACE",
                                Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                                color = Color.White, style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                        }
                    }
                }
            }
            if (data.portal.summary.isNotEmpty()) {
                item { Text("At a glance", style = MaterialTheme.typography.titleMedium, color = Color(0xFF153B38)) }
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
                                Text("Open reading", style = MaterialTheme.typography.bodySmall, color = Color(0xFF53625F))
                            }
                        }
                    }
                    item { Text("Practice", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    if (data.quizEntries.isEmpty()) item { NativeCard("No practice tests yet", "New practice activities will appear here when assigned.") }
                    items(data.quizEntries, key = { "quiz:${it.id}" }) { quiz ->
                        ElevatedCard(onClick = { openQuiz(quiz) }, modifier = Modifier.fillMaxWidth(), enabled = !busy) {
                            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(quiz.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Text("${quiz.questionCount} questions", style = MaterialTheme.typography.bodySmall)
                                quiz.latestScore?.let { Text("Previous practice: $it%", color = Color(0xFF14635D)) }
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
                    if (data.learnerReportNotice.isNotBlank()) item { Text(data.learnerReportNotice) }
                    if (data.learnerReports.isEmpty()) item { NativeCard("No report preview", "A verified enrolment and published assessments are required.") }
                    items(data.learnerReports, key = { it.id }) { report ->
                        ReportCard("My report", report.grade, report.year, report.average,
                            report.subjects, report.attendanceRate, report.presentDays, report.recordedDays,
                            "Learner preview · not an officially issued report card")
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
                                }, color = Color(0xFF53625F))
                                if (invite.status == "pending") Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Button(onClick = { respondToInvite(invite.id, true) }, enabled = !busy,
                                        modifier = Modifier.heightIn(min = 48.dp)) { Text("Accept invitation") }
                                    OutlinedButton(onClick = { respondToInvite(invite.id, false) }, enabled = !busy,
                                        modifier = Modifier.heightIn(min = 48.dp)) { Text("Decline") }
                                }
                            }
                        }
                    }
                }
                "teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head" -> {
                    item { Text("Learner support queue", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                    item { Text("Requests shown here are limited to subjects assigned to your account.", style = MaterialTheme.typography.bodyMedium) }
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
                                        Text("Review request  ›", style = MaterialTheme.typography.labelLarge, color = Color(0xFF14635D))
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
                    if (data.learnerHelp.isEmpty()) item { NativeCard("No open requests", "When you ask your school for help, updates will appear here.") }
                    items(data.learnerHelp) { NativeCard(it, "Your personal support request") }
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
            style = MaterialTheme.typography.bodySmall, color = Color(0xFF53625F), modifier = Modifier.padding(top = 8.dp)) }
    }
}

@Composable
private fun ReportCard(
    title: String, grade: String, year: Int, average: Double?,
    subjects: List<GuardianSubject>, attendanceRate: Int?, presentDays: Int,
    recordedDays: Int, note: String
) {
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFFFFFEFA))) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("$grade · $year", color = Color(0xFF53625F))
            average?.let { Text("Average  $it%", style = MaterialTheme.typography.headlineSmall, color = Color(0xFF14635D)) }
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
            Text(note, style = MaterialTheme.typography.bodySmall, color = Color(0xFF53625F))
        }
    }
}

@Composable
private fun NativeCard(title: String, subtitle: String) {
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(
        containerColor = Color(0xFFFFFEFA))) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium,
                color = Color(0xFF153B38), fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF53625F))
        }
    }
}
