package za.co.cabosolutions.learninghub

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.layout.*
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
                    signOut = { signOut() }
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
    signOut: () -> Unit
) {
    Scaffold(topBar = {
        Surface(color = Color(0xFF0D1117)) {
            Column(Modifier.fillMaxWidth().padding(20.dp)) {
                Text("CABO", color = Color(0xFFC4673A), style = MaterialTheme.typography.headlineMedium)
                Text("Learning Hub", color = Color.White, style = MaterialTheme.typography.titleMedium)
            }
        }
    }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text("Your learning journey", style = MaterialTheme.typography.headlineSmall)
                Text(status, color = Color(0xFF1D6B6B))
                Spacer(Modifier.height(12.dp))
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (data == null) {
                    Button(enabled = !busy, onClick = signIn) { Text("Sign in securely") }
                    Text("Your private records appear after verified native sign-in.",
                        style = MaterialTheme.typography.bodySmall)
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(enabled = !busy, onClick = refresh) { Text("Refresh") }
                        OutlinedButton(enabled = !busy, onClick = signOut) { Text("Sign out") }
                    }
                }
            }
            if (data != null) {
                item {
                    Text("My role: ${data.portal.role}", style = MaterialTheme.typography.titleLarge)
                    Text("Information is requested live from CABO and not saved offline.",
                        style = MaterialTheme.typography.bodySmall)
                }
                if (data.portal.summary.isNotEmpty()) {
                    item { Text("My progress", style = MaterialTheme.typography.titleMedium) }
                    items(data.portal.summary) { summary -> NativeCard(summary, "Live CABO account summary") }
                }
                item { Text("My workspace", style = MaterialTheme.typography.titleMedium) }
                items(data.portal.areas) { area -> NativeCard(area, "CABO role-based workspace") }
                item { Text("Study materials", style = MaterialTheme.typography.titleMedium) }
                if (data.materials.isEmpty()) {
                    item { Text("No visible study materials, or this section is temporarily unavailable.") }
                } else items(data.materials) { title -> NativeCard(title, "My study material") }
                item { Text("Practice tests", style = MaterialTheme.typography.titleMedium) }
                if (data.quizzes.isEmpty()) {
                    item { Text("No visible practice tests, or this section is temporarily unavailable.") }
                } else items(data.quizzes) { title -> NativeCard(title, "My practice test") }
            }
        }
    }
}

@Composable
private fun NativeCard(title: String, subtitle: String) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(subtitle, style = MaterialTheme.typography.bodySmall)
        }
    }
}
