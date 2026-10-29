package za.co.cabosolutions.learninghub

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

@Composable
internal fun NativeSchoolProgressionScreen(
    organizationName: String,
    yearText: String,
    snapshot: SchoolProgressionSnapshot?,
    busy: Boolean,
    savingEnrollmentId: Int?,
    message: String?,
    error: String?,
    onYearText: (String) -> Unit,
    refresh: () -> Unit,
    decide: (SchoolProgressionCandidate, String) -> Unit,
    close: () -> Unit
) {
    var pending by remember { mutableStateOf<Pair<SchoolProgressionCandidate, String>?>(null) }
    val year = yearText.toIntOrNull()
    val yearValid = year != null && year in 2020..2200
    Column(Modifier.fillMaxSize()) {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick = close, modifier = Modifier.heightIn(min = 48.dp)) { Text("Back") }
                Column(Modifier.padding(top = 3.dp)) {
                    Text("Year-end progression", style = MaterialTheme.typography.titleLarge)
                    Text(organizationName, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if (busy || savingEnrollmentId != null) LinearProgressIndicator(Modifier.fillMaxWidth())
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)
                .testTag("school-progression-content"),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("School progression", style = MaterialTheme.typography.headlineSmall)
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Administrator decision required", style = MaterialTheme.typography.titleSmall)
                    Text("Promoting or repeating creates a next-year enrolment and completes the previous year. CABO does not decide progression.")
                }
            }
            OutlinedTextField(
                value = yearText, onValueChange = { onYearText(it.filter(Char::isDigit).take(4)) },
                label = { Text("Current academic year") }, singleLine = true, modifier = Modifier.fillMaxWidth()
            )
            Button(onClick = refresh, enabled = !busy && savingEnrollmentId == null && yearValid,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Text(if (snapshot == null) "Load active enrolments" else "Refresh enrolments")
            }
            message?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium) }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
            snapshot?.let { result ->
                Text("Active enrolments · ${result.year}", style = MaterialTheme.typography.titleLarge)
                if (result.candidates.isEmpty()) {
                    ElevatedCard(Modifier.fillMaxWidth()) { Text("No eligible active school enrolments found for this year.", Modifier.padding(16.dp)) }
                }
                result.candidates.forEach { candidate ->
                    ElevatedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(candidate.learnerId, style = MaterialTheme.typography.titleSmall)
                            Text(
                                "Grade ${candidate.stage} · ${candidate.academicYear} → ${candidate.nextGrade ?: "School completion"}",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                candidate.nextGrade?.let { next ->
                                    Button(
                                        onClick = { pending = candidate to "promote" },
                                        enabled = savingEnrollmentId == null,
                                        modifier = Modifier.weight(1f).heightIn(min = 48.dp)
                                    ) { Text("Promote to $next") }
                                }
                                OutlinedButton(
                                    onClick = { pending = candidate to "repeat" },
                                    enabled = savingEnrollmentId == null,
                                    modifier = Modifier.weight(1f).heightIn(min = 48.dp)
                                ) { Text("Repeat grade") }
                            }
                        }
                    }
                }
                Text("Recent progression decisions", style = MaterialTheme.typography.titleLarge)
                if (result.history.isEmpty()) Text("No progression decisions have been recorded.")
                result.history.forEach { event ->
                    ElevatedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(event.learnerId, style = MaterialTheme.typography.titleSmall)
                            Text("Grade ${event.fromGrade} → ${event.toGrade} · ${event.decision.replaceFirstChar { it.uppercase() }}")
                            Text(event.approvedAt.take(10), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
    pending?.let { (candidate, decision) ->
        val targetYear = (year ?: candidate.academicYear) + 1
        val targetGrade = if (decision == "repeat") candidate.stage else candidate.nextGrade.orEmpty()
        AlertDialog(
            onDismissRequest = { if (savingEnrollmentId == null) pending = null },
            title = { Text("Confirm ${decision} for this learner?") },
            text = {
                Text(
                    "${candidate.learnerId}: Grade ${candidate.stage} → $targetGrade in $targetYear. " +
                        "This creates a new enrolment and completes the current year. CABO does not decide progression."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        pending = null
                        decide(candidate, decision)
                    },
                    enabled = savingEnrollmentId == null
                ) { Text("Confirm decision") }
            },
            dismissButton = {
                TextButton(onClick = { pending = null }, enabled = savingEnrollmentId == null) { Text("Cancel") }
            }
        )
    }
}
