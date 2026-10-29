package za.co.cabosolutions.learninghub

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

@Composable
internal fun NativeExamManagementScreen(
    workspaces: List<ExamManagementWorkspace>,
    exams: List<WrittenExam>,
    busy: Boolean,
    assign: suspend (Int, Int, Int, String?) -> Unit,
    overrideMark: suspend (Int, Int, Int, Double, String) -> Unit,
    createExam: () -> Unit,
    close: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val groupSelections = remember { mutableStateMapOf<Int, Int>() }
    val examSelections = remember { mutableStateMapOf<Int, Int>() }
    val deadlines = remember { mutableStateMapOf<Int, String>() }
    val reasons = remember { mutableStateMapOf<String, String>() }
    val marks = remember { mutableStateMapOf<String, String>() }
    var message by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Exam assignments", style = MaterialTheme.typography.headlineSmall)
            OutlinedButton(onClick = close, modifier = Modifier.heightIn(min = 48.dp)) { Text("Close") }
        }
        Text("School owners and administrators can assign their own written exams and review submitted marking.",
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Button(onClick = createExam, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
            Text("Create a written exam")
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            items(workspaces, key = { "exam-management:${it.organizationId}" }) { workspace ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(workspace.organizationName, style = MaterialTheme.typography.titleLarge)
                        workspace.notice?.let { Text(it, color = MaterialTheme.colorScheme.error) }

                        Text("Assign an exam", style = MaterialTheme.typography.titleMedium)
                        if (workspace.groups.isEmpty()) {
                            Text("No learner groups are available. Ask a school administrator to create a group.")
                        } else {
                            val selectedGroup = groupSelections[workspace.organizationId]
                                ?: workspace.groups.first().id.also { groupSelections[workspace.organizationId] = it }
                            val selectedGroupName = workspace.groups.firstOrNull { it.id == selectedGroup }?.name ?: "Choose group"
                            OutlinedButton(
                                onClick = {
                                    val index = workspace.groups.indexOfFirst { it.id == selectedGroup }.coerceAtLeast(0)
                                    groupSelections[workspace.organizationId] = workspace.groups[(index + 1) % workspace.groups.size].id
                                },
                                enabled = !busy,
                                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("assignment-group-${workspace.organizationId}")
                            ) { Text("Learner group · $selectedGroupName") }
                        }
                        if (exams.isEmpty()) {
                            Text("Create an exam from your study material before assigning it.")
                        } else {
                            val selectedExam = examSelections[workspace.organizationId]
                                ?: exams.first().id.also { examSelections[workspace.organizationId] = it }
                            val selectedExamTitle = exams.firstOrNull { it.id == selectedExam }?.title ?: "Choose exam"
                            OutlinedButton(
                                onClick = {
                                    val index = exams.indexOfFirst { it.id == selectedExam }.coerceAtLeast(0)
                                    examSelections[workspace.organizationId] = exams[(index + 1) % exams.size].id
                                },
                                enabled = !busy,
                                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("assignment-exam-${workspace.organizationId}")
                            ) { Text("Written exam · $selectedExamTitle") }
                        }
                        OutlinedTextField(
                            value = deadlines[workspace.organizationId].orEmpty(),
                            onValueChange = { deadlines[workspace.organizationId] = it.take(40) },
                            label = { Text("Optional deadline (UTC ISO 8601)") },
                            placeholder = { Text("2026-12-01T16:00Z") },
                            enabled = !busy,
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Button(
                            onClick = {
                                val groupId = groupSelections[workspace.organizationId] ?: workspace.groups.firstOrNull()?.id ?: 0
                                val examId = examSelections[workspace.organizationId] ?: exams.firstOrNull()?.id ?: 0
                                val dueAt = deadlines[workspace.organizationId]?.trim()?.takeIf { it.isNotEmpty() }
                                message = null
                                scope.launch {
                                    try {
                                        assign(workspace.organizationId, groupId, examId, dueAt)
                                        message = "Exam assigned to ${workspace.groups.firstOrNull { it.id == groupId }?.name ?: "the selected group"}."
                                    } catch (_: Exception) {
                                        message = "CABO could not create this assignment. Check the group, exam and deadline, then retry."
                                    }
                                }
                            },
                            enabled = !busy && workspace.groups.isNotEmpty() && exams.isNotEmpty(),
                            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("create-exam-assignment-${workspace.organizationId}")
                        ) { Text("Assign exam to group") }

                        Text("Current assignments", style = MaterialTheme.typography.titleMedium)
                        val assignmentRows = workspace.assignments
                        if (assignmentRows.isEmpty()) Text("No written exams assigned yet.")
                        assignmentRows.forEach { assignment ->
                            val groupName = workspace.groups.firstOrNull { it.id == assignment.groupId }?.name ?: "Group ${assignment.groupId}"
                            val examTitle = exams.firstOrNull { it.id == assignment.examId }?.title ?: "Exam ${assignment.examId}"
                            Text("$examTitle · $groupName${assignment.dueAt?.let { " · due ${it.take(10)}" } ?: ""}",
                                style = MaterialTheme.typography.bodyMedium)
                        }

                        Text("Learner submissions", style = MaterialTheme.typography.titleMedium)
                        if (workspace.submissions.isEmpty()) Text("Submitted papers will appear here.")
                        workspace.submissions.forEach { submission ->
                            Column(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("Submission #${submission.id} · ${submission.percentage}% · Assignment #${submission.assignmentId}",
                                    style = MaterialTheme.typography.titleSmall)
                                submission.feedback.forEach { mark ->
                                    val key = "${submission.id}:${mark.questionIndex}"
                                    val answer = submission.answers.getOrNull(mark.questionIndex).orEmpty()
                                    Text("Question ${mark.questionIndex + 1} · AI mark ${mark.awardedMarks}/${mark.maxMarks}")
                                    if (mark.needsReview) Text("Needs educator review", color = MaterialTheme.colorScheme.error)
                                    Text("Learner response: $answer", style = MaterialTheme.typography.bodySmall)
                                    Text(mark.feedback, style = MaterialTheme.typography.bodySmall)
                                    OutlinedTextField(
                                        value = marks[key] ?: mark.awardedMarks.toString(),
                                        onValueChange = { marks[key] = it.take(12) },
                                        label = { Text("Educator mark (max ${mark.maxMarks})") },
                                        enabled = !busy,
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth().testTag("override-mark-$key")
                                    )
                                    OutlinedTextField(
                                        value = reasons[key].orEmpty(),
                                        onValueChange = { reasons[key] = it.take(2000) },
                                        label = { Text("Reason for change (at least 5 characters)") },
                                        enabled = !busy,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                    Button(
                                        onClick = {
                                            val value = marks[key]?.toDoubleOrNull() ?: mark.awardedMarks
                                            val reason = reasons[key].orEmpty()
                                            kotlinx.coroutines.MainScope().launch {
                                                try {
                                                    overrideMark(workspace.organizationId, submission.id,
                                                        mark.questionIndex, value, reason)
                                                    message = "Educator mark review saved."
                                                } catch (_: Exception) {
                                                    message = "CABO could not save this review. Check the mark and reason, then retry."
                                                }
                                            }
                                        },
                                        enabled = !busy && (marks[key]?.toDoubleOrNull() ?: mark.awardedMarks) in 0.0..mark.maxMarks &&
                                            reasons[key].orEmpty().trim().length >= 5,
                                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                                            .testTag("save-exam-override-$key")
                                    ) { Text("Save educator mark review") }
                                }
                            }
                        }
                    }
                }
            }
        }
        message?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
