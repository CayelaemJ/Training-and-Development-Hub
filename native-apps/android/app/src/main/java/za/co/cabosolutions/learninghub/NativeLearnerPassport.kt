package za.co.cabosolutions.learninghub

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

internal data class LearnerPassportOutcome(
    val baseline: Double,
    val followup: Double,
    val improvementPp: Double
)
internal data class LearnerPassportItem(
    val id: Int,
    val concept: String,
    val status: String,
    val createdAt: String,
    val updatedAt: String,
    val outcome: LearnerPassportOutcome?
)
internal data class LearnerPassportDna(
    val ticketId: Int,
    val reviewedAt: String,
    val state: String,
    val concept: String,
    val courseId: Int?
)
internal data class LearnerPassport(
    val asOf: String,
    val items: List<LearnerPassportItem>,
    val learningDna: List<LearnerPassportDna>,
    val provenance: String,
    val interpretation: String,
    val json: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeLearnerPassportScreen(
    passport: LearnerPassport?,
    busy: Boolean,
    message: String?,
    refresh: () -> Unit,
    share: () -> Unit,
    close: () -> Unit
) {
    Scaffold(topBar = {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = close, enabled = !busy) { Text("Back") }
                Text("Learner passport", style = MaterialTheme.typography.titleLarge)
            }
        }
    }) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text("Your private learning progress", style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface)
            Text("This account-bound view includes educator-reviewed support progress and published result comparisons. Conversations, staff contact details, and unreviewed narratives are excluded.",
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(onClick = refresh, enabled = !busy, modifier = Modifier.weight(1f)) {
                    Text(if (busy) "Loading…" else "Refresh passport")
                }
                OutlinedButton(onClick = share, enabled = !busy && passport != null,
                    modifier = Modifier.weight(1f)) { Text("Export JSON") }
            }
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            message?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error) }
            passport?.let { passportData ->
                Text("Updated ${passportData.asOf.take(10)}", style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Support progress", style = MaterialTheme.typography.titleLarge)
                if (passportData.items.isEmpty()) {
                    NativeCard("No support progress yet", "Educator-reviewed support records and published result comparisons will appear here.")
                }
                passportData.items.forEach { item ->
                    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(
                        containerColor = Color(0xFFFFFEFA))) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(item.concept, style = MaterialTheme.typography.titleMedium)
                            Text("Status · ${item.status.replace('_', ' ')}", style = MaterialTheme.typography.bodySmall)
                            item.outcome?.let { outcome ->
                                Text("Published results · ${outcome.baseline}% to ${outcome.followup}%")
                                val change = if (outcome.improvementPp >= 0) "+${outcome.improvementPp}" else outcome.improvementPp.toString()
                                Text("$change percentage points · observed progress, not proof of cause",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
                Text("Learning DNA · educator reviewed", style = MaterialTheme.typography.titleLarge)
                if (passportData.learningDna.isEmpty()) NativeCard("No reviewed learning evidence", "Educator-reviewed concept evidence appears here when available.")
                passportData.learningDna.forEach { evidence ->
                    NativeCard(evidence.concept, "Reviewed state · ${evidence.state.replace('_', ' ')}")
                }
                HorizontalDivider()
                Text(passportData.provenance, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(passportData.interpretation, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
