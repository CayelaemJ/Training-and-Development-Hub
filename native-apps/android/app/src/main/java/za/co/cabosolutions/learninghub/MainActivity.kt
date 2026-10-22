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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Color(0xFFC4673A), secondary = Color(0xFF1D6B6B))) {
                NativeHome(
                    status = status,
                    busy = busy,
                    data = screen,
                    signIn = { startSignIn() },
                    refresh = { loadDashboard() },
                    signOut = { signOut() },
                    respondToInvite = { invitationId, accept -> respondToInvite(invitationId, accept) }
                )
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

    private fun signOut() {
        if (busy) return
        busy = true
        lifecycleScope.launch {
            api.signOut()
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
    respondToInvite: (Int, Boolean) -> Unit
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
                    RoleContent(Modifier.weight(0.65f), data, busy, respondToInvite)
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
                    RoleContent(Modifier.weight(1f), data, busy, respondToInvite)
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
    modifier: Modifier, data: NativeLearning?, busy: Boolean, respondToInvite: (Int, Boolean) -> Unit
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
                "parent" -> "Family connection"
                "teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head" -> "Teaching & school support"
                else -> "My learning journey"
            }, style = MaterialTheme.typography.headlineSmall)
            Text("Your CABO role: $role", style = MaterialTheme.typography.bodySmall)
        }
        if (role == "parent") {
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
            if (data.materials.isEmpty()) item { Text("No study materials available yet.") }
            else items(data.materials) { NativeCard(it, "My material") }
            item { Text("Practice tests", style = MaterialTheme.typography.titleMedium) }
            if (data.quizzes.isEmpty()) item { Text("No tests available yet.") }
            else items(data.quizzes) { NativeCard(it, "My practice test") }
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
