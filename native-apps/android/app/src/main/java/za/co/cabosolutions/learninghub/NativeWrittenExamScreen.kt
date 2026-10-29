package za.co.cabosolutions.learninghub

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeWrittenExamScreen(
    materials: List<MaterialSummary>,
    exams: List<WrittenExam>,
    generate: suspend (Int, Int, String) -> WrittenExam,
    open: suspend (Int) -> WrittenExam,
    submit: suspend (Int, List<String>) -> WrittenExamResult,
    isDemo: Boolean = false,
    close: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var materialId by remember(materials) { mutableStateOf(materials.firstOrNull()?.id ?: 0) }
    var materialMenu by remember { mutableStateOf(false) }
    var questionCount by remember { mutableStateOf(5) }
    var difficulty by remember { mutableStateOf("intermediate") }
    var exam by remember { mutableStateOf<WrittenExam?>(null) }
    var answers by remember { mutableStateOf(emptyList<String>()) }
    var result by remember { mutableStateOf<WrittenExamResult?>(null) }
    var busy by remember { mutableStateOf(false) }
    var submitted by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    fun selectExam(value: WrittenExam) {
        exam = value
        answers = List(value.questions.size) { "" }
        result = null
        submitted = false
        message = null
    }

    Scaffold(topBar = {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = close, enabled = !busy) { Text("Back") }
                Text("Written exams", style = MaterialTheme.typography.titleLarge)
            }
        }
    }) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text("Build understanding with a written response.", style = MaterialTheme.typography.bodyLarge)
            Text(if (isDemo) "Synthetic demo only · sample questions and results stay on this device." else "Questions are generated from your own CABO study material. CABO marks submitted answers against the exam rubric.",
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)

            if (materials.isEmpty()) {
                Text("Add study material before creating an exam.", style = MaterialTheme.typography.titleMedium)
            } else {
                ExposedDropdownMenuBox(expanded = materialMenu, onExpandedChange = { materialMenu = !materialMenu }) {
                    OutlinedTextField(
                        value = materials.firstOrNull { it.id == materialId }?.title ?: "Choose study material",
                        onValueChange = {}, readOnly = true, label = { Text("Study material") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = materialMenu) },
                        modifier = Modifier.menuAnchor().fillMaxWidth().testTag("written-exam-material")
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
                Text("Questions: $questionCount", style = MaterialTheme.typography.titleSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = { questionCount = (questionCount - 1).coerceAtLeast(1) }, enabled = !busy) { Text("−") }
                    OutlinedButton(onClick = { questionCount = (questionCount + 1).coerceAtMost(10) }, enabled = !busy) { Text("+") }
                }
                Text("Difficulty", style = MaterialTheme.typography.titleSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("beginner", "intermediate", "advanced").forEach { level ->
                        FilterChip(selected = difficulty == level, onClick = { difficulty = level },
                            label = { Text(level.replaceFirstChar { it.uppercase() }) }, enabled = !busy)
                    }
                }
                Button(
                    onClick = {
                        if (busy || materialId <= 0) return@Button
                        busy = true; message = null; result = null
                        scope.launch {
                            try { selectExam(generate(materialId, questionCount, difficulty)) }
                            catch (_: Exception) { message = "CABO could not generate this exam right now. Your material is still saved; try again shortly." }
                            finally { busy = false }
                        }
                    },
                    enabled = !busy && materialId > 0,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp).testTag("generate-written-exam")
                ) { Text("Generate written exam") }
            }

            if (exams.isNotEmpty()) {
                Text("Your saved exams", style = MaterialTheme.typography.titleMedium)
                exams.forEach { saved ->
                    OutlinedButton(
                        onClick = {
                            if (busy) return@OutlinedButton
                            busy = true; message = null
                            scope.launch {
                                try { selectExam(open(saved.id)) }
                                catch (_: Exception) { message = "This exam could not be opened. Check your connection and try again." }
                                finally { busy = false }
                            }
                        },
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                    ) { Text("${saved.title} · ${saved.questions.size} questions") }
                }
            }

            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            exam?.let { current ->
                HorizontalDivider()
                Text(current.title, style = MaterialTheme.typography.headlineSmall)
                Text("${current.questions.sumOf { it.maxMarks }} marks · ${current.difficulty}",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                current.questions.forEachIndexed { index, question ->
                    ElevatedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("Question ${index + 1} · ${question.type.replace('_', ' ')} · ${question.maxMarks} marks",
                                style = MaterialTheme.typography.labelLarge)
                            Text(question.prompt, style = MaterialTheme.typography.titleMedium)
                            OutlinedTextField(
                                value = answers.getOrElse(index) { "" },
                                onValueChange = { value ->
                                    if (!submitted && !busy) answers = answers.toMutableList().also { it[index] = value.take(15000) }
                                },
                                label = { Text("Your answer") }, minLines = 3,
                                enabled = !busy && !submitted,
                                modifier = Modifier.fillMaxWidth().testTag("written-answer-$index")
                            )
                            result?.feedback?.firstOrNull { it.questionIndex == index }?.let { mark ->
                                Text("${if (isDemo) "Demo feedback" else "CABO feedback"} · ${mark.awardedMarks}/${mark.maxMarks}",
                                    style = MaterialTheme.typography.titleSmall)
                                Text(mark.feedback)
                                if (mark.needsReview) Text("This response needs educator review.",
                                    color = MaterialTheme.colorScheme.tertiary, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
                Button(
                    onClick = {
                        if (busy || submitted || answers.size != current.questions.size || answers.any { it.isBlank() }) {
                            message = "Answer every question before submitting."
                            return@Button
                        }
                        submitted = true
                        busy = true
                        message = null
                        scope.launch {
                            try { result = submit(current.id, answers) }
                            catch (_: Exception) {
                                message = "CABO could not confirm the marking result. Do not submit again yet; check with your educator before retrying."
                            } finally { busy = false }
                        }
                    },
                    enabled = !busy && !submitted && answers.size == current.questions.size && answers.all { it.isNotBlank() },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp).testTag("submit-written-exam")
                ) { Text("Submit answers for marking") }
                result?.let {
                    Text("Result · ${it.percentage}% (${it.awardedMarks}/${it.maxMarks} marks)",
                        style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                    if (it.reviewRequired > 0) Text("${it.reviewRequired} answer(s) need educator review.")
                    Text("CABO’s AI marking supports learning and may be reviewed by your educator.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
