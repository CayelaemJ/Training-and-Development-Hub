package za.co.cabosolutions.learninghub

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
internal fun NativeDemoSupportRequestScreen(
    busy: Boolean,
    message: String?,
    submit: (String, String, String) -> Unit,
    close: () -> Unit
) {
    var concept by remember { mutableStateOf("Adding unlike fractions") }
    var question by remember { mutableStateOf("") }
    var attempted by remember { mutableStateOf("") }
    Scaffold(topBar = {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = close, enabled = !busy) { Text("Back") }
                Text("Ask for learning help", style = MaterialTheme.typography.titleLarge)
            }
        }
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("A useful question starts with what you tried", style = MaterialTheme.typography.titleMedium)
                    Text("This is a local demo request. It will appear in the educator's synthetic support queue and will not be sent anywhere.")
                }
            }
            OutlinedTextField(value = concept, onValueChange = { concept = it.take(160) },
                label = { Text("Topic") }, modifier = Modifier.fillMaxWidth(), enabled = !busy)
            OutlinedTextField(value = question, onValueChange = { question = it.take(4000) },
                label = { Text("What do you need help with?") }, modifier = Modifier.fillMaxWidth(),
                enabled = !busy, minLines = 4, maxLines = 8)
            OutlinedTextField(value = attempted, onValueChange = { attempted = it.take(2000) },
                label = { Text("What have you tried?") }, modifier = Modifier.fillMaxWidth(),
                enabled = !busy, minLines = 3, maxLines = 6)
            message?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Button(onClick = { submit(concept, question, attempted) },
                enabled = !busy && concept.trim().length >= 2 && question.trim().length >= 10 && attempted.trim().length >= 3,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                Text("Send demo request")
            }
        }
    }
}

@Composable
internal fun NativeSupportDraftScreen(
    courses: List<SupportCourseOption>,
    initial: NativeSupportDraft?,
    busy: Boolean,
    message: String?,
    save: (NativeSupportDraft) -> Unit,
    submit: (NativeSupportDraft) -> Unit,
    close: () -> Unit
) {
    var selectedCourse by remember(initial?.courseId, courses) {
        mutableStateOf(courses.firstOrNull { it.courseId == initial?.courseId }
            ?: initial?.let { SupportCourseOption(it.organizationId, it.courseId, it.courseName) }
            ?: courses.firstOrNull())
    }
    var menuExpanded by remember { mutableStateOf(false) }
    var concept by remember(initial?.requestKey) { mutableStateOf(initial?.concept.orEmpty()) }
    var question by remember(initial?.requestKey) { mutableStateOf(initial?.question.orEmpty()) }
    var attempted by remember(initial?.requestKey) { mutableStateOf(initial?.attempted.orEmpty()) }
    val requestKey = remember(initial?.requestKey) { initial?.requestKey ?: java.util.UUID.randomUUID().toString() }
    val valid = selectedCourse != null && concept.trim().length >= 2 &&
        question.trim().length >= 10 && attempted.trim().length >= 3
    fun draft(): NativeSupportDraft? = selectedCourse?.let { course -> NativeSupportDraft(
        requestKey = requestKey,
        organizationId = course.organizationId, courseId = course.courseId, courseName = course.name,
        concept = concept.trim(), question = question.trim(), attempted = attempted.trim()
    ) }
    Scaffold(topBar = {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = close, enabled = !busy) { Text("Back") }
                Text(if (initial == null) "Ask for learning help" else "Edit saved draft",
                    style = MaterialTheme.typography.titleLarge)
            }
        }
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Your question goes to your enrolled school", style = MaterialTheme.typography.titleMedium)
                    Text("Save it privately on this device, or send it now. An unsent draft stays encrypted and can be retried when you are online.")
                }
            }
            Text("Subject", style = MaterialTheme.typography.labelLarge)
            androidx.compose.foundation.layout.Box {
                OutlinedButton(onClick = { menuExpanded = true }, enabled = !busy,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                    Text(selectedCourse?.name ?: "Choose an enrolled subject", modifier = Modifier.weight(1f))
                    Text("⌄")
                }
                DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                    courses.forEach { course -> DropdownMenuItem(
                        text = { Text(course.name) },
                        onClick = { selectedCourse = course; menuExpanded = false }
                    ) }
                }
            }
            OutlinedTextField(value = concept, onValueChange = { concept = it.take(160) },
                label = { Text("Topic") }, modifier = Modifier.fillMaxWidth(), enabled = !busy)
            OutlinedTextField(value = question, onValueChange = { question = it.take(4000) },
                label = { Text("What do you need help with?") }, modifier = Modifier.fillMaxWidth(),
                enabled = !busy, minLines = 4, maxLines = 8)
            OutlinedTextField(value = attempted, onValueChange = { attempted = it.take(2000) },
                label = { Text("What have you tried?") }, modifier = Modifier.fillMaxWidth(),
                enabled = !busy, minLines = 3, maxLines = 6)
            message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            OutlinedButton(onClick = { draft()?.let(save) }, enabled = !busy && valid,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Save securely on this device") }
            Button(onClick = { draft()?.let(submit) }, enabled = !busy && valid,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Send to my educator") }
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
internal fun NativeSupportTicketScreen(
    ticket: SupportTicket?,
    canManageSupport: Boolean,
    reply: String,
    onReply: (String) -> Unit,
    triageReason: String,
    onTriageReason: (String) -> Unit,
    guidance: SupportGuidanceDraft?,
    busy: Boolean,
    message: String?,
    requestGuidance: () -> Unit,
    useGuidance: () -> Unit,
    sendReply: () -> Unit,
    triage: () -> Unit,
    assign: (String) -> Unit,
    schedulePractice: (String, String) -> Unit,
    close: () -> Unit
) {
    var selectedEducator by remember(ticket?.summary?.assignedTo) { mutableStateOf(ticket?.summary?.assignedTo.orEmpty()) }
    var practice by remember { mutableStateOf("") }
    var chooseReviewDate by remember { mutableStateOf(false) }
    var selectedReviewDate by remember {
        mutableStateOf(java.util.Calendar.getInstance().apply {
            add(java.util.Calendar.DAY_OF_YEAR, 1); set(java.util.Calendar.HOUR_OF_DAY, 13); set(java.util.Calendar.MINUTE, 0)
        }.timeInMillis)
    }
    val reviewDatePicker = rememberDatePickerState(initialSelectedDateMillis = selectedReviewDate)
    if (chooseReviewDate) {
        DatePickerDialog(
            onDismissRequest = { chooseReviewDate = false },
            confirmButton = { TextButton(onClick = { reviewDatePicker.selectedDateMillis?.let { selectedReviewDate = it }; chooseReviewDate = false }) { Text("Choose date") } },
            dismissButton = { TextButton(onClick = { chooseReviewDate = false }) { Text("Cancel") } }
        ) { DatePicker(state = reviewDatePicker) }
    }
    Scaffold(topBar = {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = close, enabled = !busy) { Text("Back to requests") }
                Text("Learner support", style = MaterialTheme.typography.titleLarge)
            }
        }
    }) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (ticket == null) {
                Text(message ?: "Loading this authorised support request…")
                return@Column
            }
            Text(ticket.summary.concept, style = MaterialTheme.typography.headlineSmall)
            Text("Status: ${ticket.summary.status.replace('_', ' ')}")
            Text("School workspace ${ticket.summary.organizationId} · request ${ticket.summary.id}",
                style = MaterialTheme.typography.bodySmall)
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Learner question", style = MaterialTheme.typography.titleMedium)
                    Text(ticket.question)
                    Text("What they tried", style = MaterialTheme.typography.titleMedium)
                    Text(ticket.attempted)
                }
            }
            if (ticket.summary.status == "open" && canManageSupport) {
                OutlinedTextField(
                    value = triageReason,
                    onValueChange = onTriageReason,
                    label = { Text("Triage note") },
                    supportingText = { Text("This is added to the request history.") },
                    modifier = Modifier.fillMaxWidth(), enabled = !busy,
                    minLines = 2, maxLines = 4
                )
                Button(onClick = triage, enabled = !busy && triageReason.trim().length >= 3,
                    modifier = Modifier.heightIn(min = 48.dp)) { Text("Mark as triaged") }
            }
            if (ticket.summary.status !in listOf("resolved", "closed") && canManageSupport) {
                Text("Assignment and practice", style = MaterialTheme.typography.titleMedium)
                if (ticket.educators.isNotEmpty()) {
                    Box {
                        var expanded by remember { mutableStateOf(false) }
                        OutlinedButton(onClick = { expanded = true }, enabled = !busy) {
                            Text(ticket.educators.firstOrNull { it.id == selectedEducator }?.name ?: "Choose an authorised educator")
                        }
                        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                            ticket.educators.forEach { educator ->
                                DropdownMenuItem(text = { Text(educator.name) }, onClick = { selectedEducator = educator.id; expanded = false })
                            }
                        }
                    }
                    Button(onClick = { assign(selectedEducator) }, enabled = !busy && selectedEducator.isNotBlank() && selectedEducator != ticket.summary.assignedTo,
                        modifier = Modifier.heightIn(min = 48.dp)) { Text("Assign authorised educator") }
                }
                OutlinedTextField(value = practice, onValueChange = { practice = it.take(4000) },
                    label = { Text("Practice activity") }, modifier = Modifier.fillMaxWidth(), enabled = !busy, minLines = 2, maxLines = 5)
                OutlinedButton(onClick = { chooseReviewDate = true }, enabled = !busy) {
                    Text("Review checkpoint: ${java.text.SimpleDateFormat("EEE, d MMM yyyy", java.util.Locale.getDefault()).format(java.util.Date(selectedReviewDate))}")
                }
                Button(onClick = {
                    val reviewAt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
                        timeZone = java.util.TimeZone.getTimeZone("UTC")
                    }.format(java.util.Date(selectedReviewDate + 12 * 60 * 60 * 1000L))
                    schedulePractice(practice, reviewAt)
                }, enabled = !busy && practice.trim().length >= 5,
                    modifier = Modifier.heightIn(min = 48.dp)) { Text("Assign practice and checkpoint") }
            }
            if (canManageSupport) {
                Text("Reply to learner", style = MaterialTheme.typography.titleMedium)
                OutlinedTextField(
                    value = reply,
                    onValueChange = onReply,
                    label = { Text("Write a response") },
                    supportingText = { Text("Review and edit any suggested text before sending.") },
                    modifier = Modifier.fillMaxWidth(), enabled = !busy,
                    minLines = 4, maxLines = 10
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = requestGuidance, enabled = !busy,
                        modifier = Modifier.heightIn(min = 48.dp)) { Text("Draft learning guidance") }
                    Button(onClick = sendReply,
                        enabled = !busy && reply.trim().length in 2..4000,
                        modifier = Modifier.heightIn(min = 48.dp)) { Text("Send reply") }
                }
            }
            guidance?.let { draft ->
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Suggested draft · ${if (draft.source == "ai_draft") "AI, review required" else "CABO template"}",
                            style = MaterialTheme.typography.titleMedium)
                        Text(draft.explanation)
                        draft.questions.forEach { Text("Think about: $it") }
                        draft.practice.forEach { Text("Practice: $it") }
                        OutlinedButton(onClick = useGuidance, enabled = !busy,
                            modifier = Modifier.heightIn(min = 48.dp)) { Text("Add draft to reply") }
                    }
                }
            }
            message?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Text("Request history", style = MaterialTheme.typography.titleMedium)
            if (ticket.history.isEmpty()) Text("No updates have been recorded yet.")
            ticket.history.forEach { event ->
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(event.kind.replace('_', ' '), style = MaterialTheme.typography.labelLarge)
                        Text(event.body)
                        if (event.createdAt.isNotBlank())
                            Text(event.createdAt, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}
