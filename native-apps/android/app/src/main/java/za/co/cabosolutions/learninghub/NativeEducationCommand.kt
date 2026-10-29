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
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
internal fun NativeEducationCommandScreen(
    snapshot: EducationCommandSnapshot?,
    busy: Boolean,
    message: String?,
    refresh: () -> Unit,
    close: () -> Unit
) {
    Column(Modifier.fillMaxSize()) {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(onClick = close, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) {
                    Text("Back")
                }
                Text(
                    "Education Command",
                    modifier = Modifier.padding(top = 10.dp),
                    style = MaterialTheme.typography.titleLarge
                )
            }
        }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Privacy-safe school overview", style = MaterialTheme.typography.headlineSmall)
            Text(
                "Only schools your account is authorised to oversee are included. Small learner cohorts are suppressed.",
                style = MaterialTheme.typography.bodyMedium
            )
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Internal planning view · not an official national census",
                        style = MaterialTheme.typography.titleSmall,
                        color = Color(0xFF7A4126)
                    )
                    Text("Attendance reflects recorded entries. It does not establish enrolment quality or school performance.")
                    Text("No learner names or individual records are returned by this view.", style = MaterialTheme.typography.bodySmall)
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(onClick = refresh, enabled = !busy, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) {
                    Text(if (snapshot == null) "Load overview" else "Refresh")
                }
            }
            message?.let {
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Text(it, Modifier.padding(16.dp), color = MaterialTheme.colorScheme.error)
                }
            }
            snapshot?.let { result ->
                Text("Academic year ${result.year}", style = MaterialTheme.typography.titleMedium)
                Text("${result.institutions} authorised schools", style = MaterialTheme.typography.titleLarge)
                Text("Active verified learners and recorded attendance", style = MaterialTheme.typography.bodyMedium)
                if (result.schools.isEmpty()) {
                    ElevatedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("No school aggregates available", style = MaterialTheme.typography.titleMedium)
                            Text("This account may have no eligible school scope for this year.")
                        }
                    }
                }
                result.schools.forEach { school ->
                    ElevatedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(school.name, style = MaterialTheme.typography.titleMedium)
                            Text(
                                school.learnerCount?.let { "At least $it active verified learners" }
                                    ?: "Learner count suppressed for privacy (fewer than ${result.minimumCohort})",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                school.attendanceRate?.let { "Recorded attendance: $it% · ${result.year}" }
                                    ?: "No attendance rate available for this year",
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }
                Text(
                    if (!result.nationalVerified || !result.officialDbEData)
                        "CABO has not verified this as national or official education data."
                    else "National and official-data status is supplied by the server.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}
