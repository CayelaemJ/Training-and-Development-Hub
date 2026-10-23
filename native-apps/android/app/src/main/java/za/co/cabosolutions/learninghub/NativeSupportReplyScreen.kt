package za.co.cabosolutions.learninghub

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// Reply text is always educator-authored; no auto-sending AI or cached PII.
@Composable
internal fun NativeSupportReplyScreen(
    ticket: SupportTicket,
    reply: String,
    busy: Boolean,
    attempted: Boolean,
    message: String?,
    onReply: (String) -> Unit,
    submit: () -> Unit,
    close: () -> Unit
) {
    Scaffold(topBar = {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = close, enabled = !busy) { Text("Back") }
                Text("Learning support", style = MaterialTheme.typography.titleLarge)
            }
        }
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)
            .verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(ticket.concept, style = MaterialTheme.typography.headlineSmall)
            Text("Ticket #${ticket.id} · ${ticket.status}")
            Text("Write your own educator reply. It will be recorded in the secure school's support history.")
            OutlinedTextField(
                value = reply, onValueChange = onReply,
                label = { Text("Educator reply") }, enabled = !busy && !attempted,
                minLines = 5, maxLines = 9, modifier = Modifier.fillMaxWidth()
            )
            Text("${reply.length} / 4,000 characters", style = MaterialTheme.typography.bodySmall)
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            message?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            Button(
                onClick = submit,
                enabled = !busy && !attempted && reply.trim().length in 2..4000,
                modifier = Modifier.heightIn(min = 48.dp)
            ) { Text("Send educator reply") }
            Text("If the response is interrupted, check the ticket history before trying again. The server verifies ticket versions.",
                style = MaterialTheme.typography.bodySmall)
        }
    }
}
