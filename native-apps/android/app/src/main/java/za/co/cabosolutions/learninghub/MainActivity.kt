package za.co.cabosolutions.learninghub

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

// Jetpack Compose native screen; no WebView or embedded web application.
// Learner resources come from CABO's permission-filtered existing endpoints.
class MainActivity : ComponentActivity() {
    private val api by lazy { NativeApi(this) }
    private var status by mutableStateOf("CABO native Android preview")
    private var busy by mutableStateOf(false)
    private var screen by mutableStateOf<NativeLearning?>(null)
    private var selectedQuiz by mutableStateOf<QuizSummary?>(null)
    private var selectedMaterial by mutableStateOf<MaterialSummary?>(null)
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
            MaterialTheme(colorScheme = lightColorScheme(primary = Color(0xFFC4673A), secondary = Color(0xFF1D6B6B))) {
                when {
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
                        status = status, busy = busy, data = screen,
                        signIn = { startSignIn() }, refresh = { loadDashboard() },
                        signOut = { signOut() },
                        respondToInvite = { invitationId, accept -> respondToInvite(invitationId, accept) },
                        openQuiz = { openQuiz(it) },
                        openMaterial = { openMaterial(it) }
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
                screen = api.dashboard()
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
        readNextPage()
    }

    private fun readNextPage() {
        val id = selectedMaterial?.id ?: return
        val offset = nextPage ?: return
        if (studyBusy) return
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
            api.signOut()
            closeStudy()
            screen = null
            status = "Signed out on this device."
            busy = false
        }
    }
}

@Composable
private fun NativeHome(
    status: String,
    busy: Boolean,
    data: NativeLearning?,
    signIn: () -> Unit,
    refresh: () -> Unit,
    signOut: () -> Unit,
    respondToInvite: (Int, Boolean) -> Unit,
    openQuiz: (QuizSummary) -> Unit,
    openMaterial: (MaterialSummary) -> Unit
) {
    Scaffold(topBar = {
        Surface(color = Color(0xFF0D1117)) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp)) {
                Text("CABO", color = Color(0xFFC4673A), style = MaterialTheme.typography.headlineMedium)
                Text("Learning Hub", color = Color.White, style = MaterialTheme.typography.titleMedium)
            }
        }
    }) { padding ->
        BoxWithConstraints(Modifier.fillMaxSize().padding(padding)) {
            // Tablet uses an actual two-pane layout; phones remain one-pane.
            // No feature or data is blocked merely because a device is small.
            val tablet = maxWidth >= 600.dp
            if (tablet) {
                Row(Modifier.fillMaxSize().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    Column(Modifier.widthIn(min = 190.dp, max = 250.dp).weight(0.35f)) {
                        Text(if (data?.portal?.role == "parent") "Family space" else "My school space",
                            style = MaterialTheme.typography.headlineSmall)
                        Spacer(Modifier.height(12.dp))
                        Text(status, color = Color(0xFF1D6B6B))
                        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                        Spacer(Modifier.height(16.dp))
                        SessionButtons(data, busy, signIn, refresh, signOut)
                        Spacer(Modifier.height(16.dp))
                        Text("Tablet layout • touch, keyboard and accessibility supported",
                            style = MaterialTheme.typography.bodySmall)
                    }
                    RoleContent(Modifier.weight(0.65f), data, busy, respondToInvite, openQuiz, openMaterial)
                }
            } else {
                Column(Modifier.fillMaxSize()) {
                    Column(Modifier.fillMaxWidth().padding(16.dp)) {
                        Text("Your CABO space", style = MaterialTheme.typography.titleLarge)
                        Text(status, color = Color(0xFF1D6B6B))
                        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                        Spacer(Modifier.height(8.dp))
                        SessionButtons(data, busy, signIn, refresh, signOut)
                    }
                    RoleContent(Modifier.weight(1f), data, busy, respondToInvite, openQuiz, openMaterial)
                }
            }
        }
    }
}

@Composable
private fun SessionButtons(
    data: NativeLearning?, busy: Boolean, signIn: () -> Unit, refresh: () -> Unit, signOut: () -> Unit
) {
    if (data == null) {
        Button(onClick = signIn, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) {
            Text("Sign in securely")
        }
    } else {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = refresh, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) {
                Text("Refresh")
            }
            OutlinedButton(onClick = signOut, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) {
                Text("Sign out")
            }
        }
    }
}

@Composable
private fun RoleContent(
    modifier: Modifier, data: NativeLearning?, busy: Boolean,
    respondToInvite: (Int, Boolean) -> Unit,
    openQuiz: (QuizSummary) -> Unit,
    openMaterial: (MaterialSummary) -> Unit
) {
    LazyColumn(modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (data == null) {
            item { Text("Sign in to see your school or family workspace. Your private data is not downloaded until authorized.") }
            item { NativeCard("Teachers", "Lessons, assigned subjects and learning support requests on tablets.") }
            item { NativeCard("Learners", "Study materials, progress and practice tests on tablets or phones.") }
            item { NativeCard("Parents", "Guardian invitations and verified child connections on phones.") }
            return@LazyColumn
        }
        val role = data.portal.role
        item {
            Text(when(role) {
                "superadmin" -> "Platform governance"
                "parent" -> "Family connection"
                "teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head" -> "Teaching & school support"
                else -> "My learning journey"
            }, style = MaterialTheme.typography.headlineSmall)
            Text("Your CABO role: $role", style = MaterialTheme.typography.bodySmall)
        }
        if (role == "superadmin") {
            item { Text("Platform governance", style = MaterialTheme.typography.titleMedium) }
            item { Text("Read-only organisation registry. Private learner records remain restricted.") }
            items(data.portal.summary) { NativeCard(it, "CABO registry summary") }
            if (data.adminOrganizations.isEmpty()) item { NativeCard("No organisations", "No registered organisations to display.") }
            items(data.adminOrganizations) { name ->
                NativeCard(name, "CABO institution registry")
            }
        } else if (role == "parent") {
            item {
                Text("Guardian invitations", style = MaterialTheme.typography.titleMedium)
                Text(data.parentGuidance, style = MaterialTheme.typography.bodySmall)
            }
            if (data.guardians.isEmpty()) {
                item { NativeCard("No invitations", "A learner can invite you through their CABO account.") }
            }
            items(data.guardians, key = { it.id }) { invite ->
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(invite.learnerName ?: "Private learner invitation",
                            style = MaterialTheme.typography.titleMedium)
                        Text(when(invite.status) {
                            "pending" -> "Invitation waiting for your answer"
                            "accepted" -> "Accepted · school verification pending"
                            "verified" -> if (invite.verified) "Verified guardian connection" else "School enrolment needs confirmation"
                            "revoked" -> "Connection revoked"
                            else -> "Status: ${invite.status}"
                        })
                        if (invite.status == "pending") {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = { respondToInvite(invite.id, true) },
                                    enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)
                                ) { Text("Accept") }
                                OutlinedButton(
                                    onClick = { respondToInvite(invite.id, false) },
                                    enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)
                                ) { Text("Decline") }
                            }
                        }
                    }
                }
            }
        } else if (role in listOf("teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head")) {
            item { Text("My assigned teaching work", style = MaterialTheme.typography.titleMedium) }
            if (data.staff.isEmpty()) item {
                NativeCard("No school assignments yet", "Ask your institution administrator to assign your teaching role.")
            }
            items(data.staff, key = { it.organizationId }) { org ->
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("School workspace ${org.organizationId}", style = MaterialTheme.typography.titleMedium)
                        org.notice?.let { Text(it) }
                        if (org.courses.isEmpty()) Text("No assigned subjects are available.")
                        org.courses.forEach { Text("• $it", style = MaterialTheme.typography.bodyLarge) }
                        if (org.supportSummary.isNotEmpty()) {
                            Text("Learning support", style = MaterialTheme.typography.titleSmall)
                            org.supportSummary.forEach { Text(it) }
                        }
                        if (org.tickets.isNotEmpty()) {
                            Text("Learner help requests", style = MaterialTheme.typography.titleSmall)
                            org.tickets.forEach { Text("• $it") }
                        }
                    }
                }
            }
            item { Text("Support actions and marking screens will follow after real-device authorization testing.") }
        } else {
            item { Text("My academic progress", style = MaterialTheme.typography.titleMedium) }
            items(data.portal.summary + data.journey) { NativeCard(it, "Current CABO account data") }
            item { Text("Study materials", style = MaterialTheme.typography.titleMedium) }
            if (data.materialEntries.isEmpty()) item { Text("No study materials available yet.") }
            else items(data.materialEntries, key = { it.id }) { material ->
                ElevatedCard(onClick = { openMaterial(material) }, modifier = Modifier.fillMaxWidth(),
                    enabled = !busy) {
                    Column(Modifier.padding(16.dp)) {
                        Text(material.title, style = MaterialTheme.typography.titleMedium)
                        Text("Read your learning material", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            item { Text("Practice tests", style = MaterialTheme.typography.titleMedium) }
            if (data.quizEntries.isEmpty()) item { Text("No tests available yet.") }
            else items(data.quizEntries, key = { it.id }) { quiz ->
                ElevatedCard(onClick = { openQuiz(quiz) }, modifier = Modifier.fillMaxWidth(),
                    enabled = !busy) {
                    Column(Modifier.padding(16.dp)) {
                        Text(quiz.title, style = MaterialTheme.typography.titleMedium)
                        Text("${quiz.questionCount} questions", style = MaterialTheme.typography.bodySmall)
                        quiz.latestScore?.let {
                            Text("Previous score: $it%", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
            item { Text("My learning support", style = MaterialTheme.typography.titleMedium) }
            if (data.learnerHelp.isEmpty()) item { Text("No personal help requests to display.") }
            else items(data.learnerHelp) { NativeCard(it, "My support request") }
        }
        item { Text("Information is loaded securely from CABO when online, not kept as a private offline cache.",
            style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun NativeCard(title: String, subtitle: String) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
