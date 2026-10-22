package za.co.cabosolutions.learninghub

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

// Real Android native controls, not an embedded webpage.
// Network access uses a real CABO endpoint, but authenticated learner records
// deliberately stay blocked until a native OAuth PKCE flow is implemented.
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Color(0xFFC4673A), secondary = Color(0xFF1D6B6B))) {
                CaboHome(openSignIn = {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.API_ORIGIN + "/api/login")))
                })
            }
        }
    }
}

private data class Module(val title: String, val subtitle: String)
private val modules = listOf(
    Module("My learning", "Lessons and personal progress"),
    Module("Practice tests", "Questions, results and feedback"),
    Module("Academic journey", "Subjects, school terms and milestones"),
    Module("Sports and activities", "Development and achievements"),
    Module("Teacher support", "Interventions and learning help")
)

@Composable
private fun CaboHome(openSignIn: () -> Unit) {
    var apiStatus by remember { mutableStateOf("Checking CABO service…") }
    LaunchedEffect(Unit) {
        apiStatus = withContext(Dispatchers.IO) {
            try {
                val connection = (URL(BuildConfig.API_ORIGIN + "/api/auth/user").openConnection() as HttpURLConnection)
                connection.connectTimeout = 8000
                connection.readTimeout = 8000
                connection.requestMethod = "GET"
                try {
                    if (connection.responseCode == 200) "CABO service reachable · Sign in required"
                    else "CABO service returned HTTP ${connection.responseCode}"
                } finally { connection.disconnect() }
            } catch (_: Exception) { "Cannot reach CABO. Check your internet connection." }
        }
    }
    Scaffold(topBar = { Surface(color = Color(0xFF0D1117)) {
        Column(Modifier.fillMaxWidth().padding(20.dp)) {
            Text("CABO", color = Color(0xFFC4673A), style = MaterialTheme.typography.headlineMedium)
            Text("Learning Hub", color = Color.White, style = MaterialTheme.typography.titleMedium)
        }
    } }) { padding ->
        LazyColumn(Modifier.padding(padding).fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Text("Your learning journey", style = MaterialTheme.typography.headlineSmall)
                Text("Native Android preview • no learner data is stored on this device")
                Spacer(Modifier.height(12.dp))
                Text(apiStatus, color = Color(0xFF1D6B6B))
                Spacer(Modifier.height(12.dp))
                Button(onClick = openSignIn) { Text("Sign in securely in your browser") }
                Text("Native sign-in and authenticated screens are still being built.", style = MaterialTheme.typography.bodySmall)
            }
            items(modules) { module ->
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(18.dp)) {
                        Text(module.title, style = MaterialTheme.typography.titleMedium)
                        Text(module.subtitle, style = MaterialTheme.typography.bodyMedium)
                        Text("Coming to native CABO", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}
