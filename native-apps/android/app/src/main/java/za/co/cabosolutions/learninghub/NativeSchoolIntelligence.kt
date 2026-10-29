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
import androidx.compose.material3.Button
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
internal fun NativeSchoolIntelligenceScreen(
    organizationName: String,
    yearText: String,
    snapshot: SchoolIntelligenceSnapshot?,
    busy: Boolean,
    message: String?,
    onYearText: (String) -> Unit,
    refresh: () -> Unit,
    close: () -> Unit
) {
    val yearValid = yearText.toIntOrNull()?.let { it in 2000..2200 } == true
    Column(Modifier.fillMaxSize()) {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(onClick = close, modifier = Modifier.heightIn(min = 48.dp)) { Text("Back") }
                Column(Modifier.padding(top = 3.dp)) {
                    Text("School intelligence", style = MaterialTheme.typography.titleLarge)
                    Text(organizationName, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)
                .testTag("school-intelligence-content"),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Attendance & academic signals", style = MaterialTheme.typography.headlineSmall)
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Educator review only", style = MaterialTheme.typography.titleSmall, color = Color(0xFF7A4126))
                    Text(
                        "Low marks and absences are prompts for human support. They are not automated punishments, psychological labels or progression decisions."
                    )
                    Text(
                        "Only accounts authorised by this school can load these records. Attendance figures are recorded entries, not verified district data.",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
            OutlinedTextField(
                value = yearText, onValueChange = { onYearText(it.filter(Char::isDigit).take(4)) },
                label = { Text("Academic year") }, singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = refresh, enabled = !busy && yearValid,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
            ) { Text(if (snapshot == null) "Load school signals" else "Refresh school signals") }
            message?.let {
                ElevatedCard(Modifier.fillMaxWidth()) { Text(it, Modifier.padding(16.dp), color = MaterialTheme.colorScheme.error) }
            }
            snapshot?.let { result ->
                Text("Academic year ${result.year}", style = MaterialTheme.typography.titleMedium)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MetricCard("Attendance records", result.attendanceRecords.toString(), Modifier.weight(1f))
                    MetricCard("Learners reviewed", result.studentsReviewed.toString(), Modifier.weight(1f))
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MetricCard("Need educator attention", result.attentionNeeded.toString(), Modifier.weight(1f))
                    MetricCard("Official district data", if (result.officialDistrictData) "Yes" else "No", Modifier.weight(1f))
                }
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Recorded attendance", style = MaterialTheme.typography.titleMedium)
                        Text("${result.attendanceRecords} entries · year ${result.year}")
                        result.attendanceCounts.toSortedMap().forEach { (kind, count) ->
                            Text("${kind.replaceFirstChar { it.uppercase() }}: $count")
                        }
                        if (result.attendanceCounts.isEmpty()) Text("No attendance records available for this year.")
                    }
                }
                Text("Academic attention register", style = MaterialTheme.typography.titleLarge)
                Text(
                    "Signals use the server thresholds: subject average below ${result.subjectBelow}% or recorded attendance below ${result.attendanceBelow}%. Review each case with the learner.",
                    style = MaterialTheme.typography.bodySmall
                )
                if (result.learners.isEmpty()) {
                    ElevatedCard(Modifier.fillMaxWidth()) {
                        Text("No learner assessments available for this year.", Modifier.padding(16.dp))
                    }
                }
                result.learners.forEach { learner ->
                    ElevatedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(learner.learnerId, style = MaterialTheme.typography.titleSmall)
                            Text("Grade ${learner.grade} · ${learner.supportPlans} existing support entries")
                            Text("Average ${learner.average?.let { "%.1f".format(java.util.Locale.US, it) + "%" } ?: "—"} · Attendance ${learner.attendanceRate?.let { "%.1f".format(java.util.Locale.US, it) + "%" } ?: "—"}")
                            if (learner.subjectsAtRisk.isNotEmpty()) {
                                Text("Educator review: ${learner.subjectsAtRisk.joinToString(", ")}", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MetricCard(label: String, value: String, modifier: Modifier = Modifier) {
    ElevatedCard(modifier) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall)
            Text(value, style = MaterialTheme.typography.titleMedium)
        }
    }
}
