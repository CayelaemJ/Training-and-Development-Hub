package za.co.cabosolutions.learninghub

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * Study tutor over the learner's own material. Conversation stays in memory only: it is not
 * cached, logged or kept after the screen closes, and only the current question is sent.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeTutorScreen(
    materials: List<MaterialSummary>,
    ask: suspend (Int, String) -> TutorAnswer,
    askTeacher: () -> Unit,
    isDemo: Boolean = false,
    close: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var materialId by remember(materials) { mutableStateOf(materials.firstOrNull()?.id ?: 0) }
    var materialMenu by remember { mutableStateOf(false) }
    var question by remember { mutableStateOf("") }
    var turns by remember { mutableStateOf(emptyList<TutorTurn>()) }
    var inputMessage by remember { mutableStateOf<String?>(null) }
    var showTrustedAdult by remember { mutableStateOf(false) }
    var job by remember { mutableStateOf<Job?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(turns.size) { if (turns.isNotEmpty()) listState.animateScrollToItem(turns.size - 1) }

    fun send() {
        when (val check = NativeTutorRules.check(question)) {
            is TutorQuestionCheck.Invalid -> inputMessage = check.message
            TutorQuestionCheck.NeedsTrustedAdult -> { inputMessage = null; showTrustedAdult = true; question = "" }
            is TutorQuestionCheck.Ready -> {
                val target = materialId
                inputMessage = null
                question = ""
                busy = true
                job = scope.launch {
                    try {
                        val turn = try {
                            TutorTurn(check.question, ask(target, check.question), null)
                        } catch (e: CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            TutorTurn(check.question, null, NativeTutorRules.errorMessage(e))
                        }
                        turns = NativeTutorRules.append(turns, turn)
                    } finally { busy = false }
                }
            }
        }
    }

    Scaffold(topBar = {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = { job?.cancel(); close() }, modifier = Modifier.testTag("tutor-back")) { Text("Back") }
                Text("Study tutor", style = MaterialTheme.typography.titleLarge)
            }
        }
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).imePadding().padding(horizontal = 16.dp)) {
            Text(
                if (isDemo) "Synthetic demo only · sample answers are written on this device and nothing is sent to CABO."
                else "Ask about one of your own study materials. Answers come only from that material and quote where they found it. Check important answers with your teacher.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 12.dp, bottom = 8.dp)
            )
            if (materials.isEmpty()) {
                Text("Add study material in Learn before asking the tutor.", style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.testTag("tutor-no-materials"))
                return@Column
            }
            ExposedDropdownMenuBox(expanded = materialMenu, onExpandedChange = { if (!busy) materialMenu = !materialMenu }) {
                OutlinedTextField(
                    value = materials.firstOrNull { it.id == materialId }?.title ?: "Choose study material",
                    onValueChange = {}, readOnly = true, label = { Text("Study material") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = materialMenu) },
                    modifier = Modifier.menuAnchor().fillMaxWidth().testTag("tutor-material")
                )
                ExposedDropdownMenu(expanded = materialMenu, onDismissRequest = { materialMenu = false }) {
                    materials.forEach { material ->
                        DropdownMenuItem(text = { Text(material.title) }, onClick = {
                            materialId = material.id
                            materialMenu = false
                        })
                    }
                }
            }
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth().padding(vertical = 8.dp).testTag("tutor-turns"),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (turns.isEmpty() && !busy) item {
                    Text("Try: \"What is the main idea of section 2?\" or \"Explain this term in simpler words.\"",
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                itemsIndexed(turns) { index, turn -> TutorTurnCard(index, turn) }
                if (busy) item {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        Text("Reading your material…")
                    }
                }
            }
            inputMessage?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag("tutor-input-message"))
            }
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = androidx.compose.ui.Alignment.Bottom) {
                OutlinedTextField(
                    value = question,
                    onValueChange = { if (it.length <= NativeTutorRules.MAX_QUESTION) question = it },
                    label = { Text("Your question") },
                    enabled = !busy,
                    maxLines = 4,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSend = { if (!busy) send() }),
                    modifier = Modifier.weight(1f).testTag("tutor-question")
                )
                Button(onClick = { send() }, enabled = !busy && question.isNotBlank(),
                    modifier = Modifier.heightIn(min = 56.dp).testTag("tutor-send")) { Text("Ask") }
            }
        }
    }

    if (showTrustedAdult) {
        AlertDialog(
            onDismissRequest = { showTrustedAdult = false },
            title = { Text("You don't have to handle this alone") },
            text = { Text(NativeTutorRules.TRUSTED_ADULT_MESSAGE, modifier = Modifier.testTag("tutor-trusted-adult")) },
            confirmButton = {
                Button(onClick = { showTrustedAdult = false; job?.cancel(); askTeacher() }) { Text("Ask a teacher for help") }
            },
            dismissButton = { TextButton(onClick = { showTrustedAdult = false }) { Text("Close") } }
        )
    }
}

@Composable
private fun TutorTurnCard(index: Int, turn: TutorTurn) {
    Column(Modifier.fillMaxWidth().testTag("tutor-turn-$index"), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium,
            modifier = Modifier.fillMaxWidth()) {
            Text(turn.question, modifier = Modifier.padding(12.dp), style = MaterialTheme.typography.bodyMedium)
        }
        val answer = turn.answer
        if (answer == null) {
            Text(turn.notice ?: "No answer.", color = MaterialTheme.colorScheme.error,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        } else {
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp).semantics { liveRegion = LiveRegionMode.Polite },
                    verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(answer.answer, style = MaterialTheme.typography.bodyLarge)
                    Text("From ${answer.materialTitle}:", style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    answer.citations.forEach { citation ->
                        Text("“${citation.excerpt}”", style = MaterialTheme.typography.bodySmall, fontStyle = FontStyle.Italic)
                    }
                    if (answer.reviewRequired) Text("AI answer · check with your teacher before relying on it.",
                        style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
