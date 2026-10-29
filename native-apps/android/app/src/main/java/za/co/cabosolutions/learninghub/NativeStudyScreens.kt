package za.co.cabosolutions.learninghub

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// Actual CABO API quiz. Never renders a locally fabricated answer key or grade.
@Composable
internal fun NativeQuizScreen(
    summary: QuizSummary,
    quiz: PracticeQuiz?,
    answers: List<Int?>,
    attempt: QuizAttempt?,
    busy: Boolean,
    submitted: Boolean,
    message: String?,
    uncertain: Boolean,
    recover: () -> Unit,
    answer: (Int, Int) -> Unit,
    submit: () -> Unit,
    close: () -> Unit
) {
    Scaffold(topBar = {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = close, enabled = !busy) { Text("Back") }
                Text("CABO practice test", style = MaterialTheme.typography.titleLarge)
            }
        }
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)
            .verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(summary.title, style = MaterialTheme.typography.headlineSmall)
            Text("Practice results come from CABO, not this device.")
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            message?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            quiz?.questions?.forEachIndexed { index, question ->
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Question ${index + 1} of ${quiz.questions.size}",
                            style = MaterialTheme.typography.labelMedium)
                        Text(question.prompt, style = MaterialTheme.typography.titleMedium)
                        question.options.forEachIndexed { optionIndex, option ->
                            Row(
                                Modifier.fillMaxWidth().heightIn(min = 48.dp)
                                    .clickable(enabled = !submitted && !busy) {
                                        answer(index, optionIndex)
                                    }.padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                RadioButton(selected = answers.getOrNull(index) == optionIndex,
                                    onClick = { answer(index, optionIndex) },
                                    enabled = !submitted && !busy)
                                Text(option, style = MaterialTheme.typography.bodyLarge,
                                    modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
            if (quiz != null && !submitted) {
                Button(onClick = submit, enabled = !busy && quiz.questions.isNotEmpty() &&
                    answers.size == quiz.questions.size && answers.all { it != null },
                    modifier = Modifier.heightIn(min = 48.dp)) {
                    Text("Submit answers")
                }
                Text("If the connection breaks during submission, check your assessment history. Do not submit again blindly.",
                    style = MaterialTheme.typography.bodySmall)
            }
            if (uncertain && !busy) {
                Button(onClick = recover, modifier = Modifier.heightIn(min = 48.dp)) {
                    Text("Check submission status")
                }
            }
            attempt?.let { result ->
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("Your results", style = MaterialTheme.typography.headlineSmall)
                        Text("${result.correctCount} of ${result.totalQuestions} correct · ${result.percentage}%",
                            style = MaterialTheme.typography.titleMedium)
                        Text("Automated feedback is not a human-verified qualification.",
                            style = MaterialTheme.typography.bodySmall)
                        result.feedback.forEach { item ->
                            Text("Question ${item.questionIndex + 1}: ${if (item.isCorrect) "Correct" else "Review"}",
                                style = MaterialTheme.typography.titleSmall)
                            Text(item.explanation)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeMaterialUploadScreen(
    fileName: String,
    title: String,
    busy: Boolean,
    message: String?,
    onTitle: (String) -> Unit,
    upload: () -> Unit,
    close: () -> Unit
) {
    Scaffold(topBar = {
        TopAppBar(
            title = { Text("Add study material") },
            navigationIcon = {
                TextButton(onClick = close, enabled = !busy) { Text("Cancel") }
            }
        )
    }) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding)
                .verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Bring your notes in", style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.primary)
            Text("Your document is uploaded to your private CABO study library.",
                style = MaterialTheme.typography.bodyLarge)
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("SELECTED FILE", style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary)
                    Text(fileName, style = MaterialTheme.typography.titleMedium)
                    Text("PDF, Word, PowerPoint, Excel, TXT, Markdown, CSV, PNG, JPEG or WebP · up to 30 MB",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            OutlinedTextField(
                value = title,
                onValueChange = { onTitle(it.take(200)) },
                label = { Text("Material title") },
                placeholder = { Text("For example, Week 4 · Cell biology") },
                singleLine = true,
                enabled = !busy,
                modifier = Modifier.fillMaxWidth()
            )
            Surface(color = MaterialTheme.colorScheme.surfaceVariant,
                shape = MaterialTheme.shapes.medium) {
                Text("AI reading stays off. CABO checks the file format before extracting study text.",
                    Modifier.fillMaxWidth().padding(14.dp),
                    style = MaterialTheme.typography.bodyMedium)
            }
            message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            Button(onClick = upload, enabled = !busy && title.isNotBlank(),
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                Text(if (busy) "Adding material…" else "Add to my library")
            }
        }
    }
}

@Composable
internal fun NativeMaterialScreen(
    summary: MaterialSummary,
    content: String,
    nextOffset: Int?,
    busy: Boolean,
    message: String?,
    next: () -> Unit,
    close: () -> Unit
) {
    Scaffold(topBar = {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = close, enabled = !busy) { Text("Back") }
                Text("CABO study material", style = MaterialTheme.typography.titleLarge)
            }
        }
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)
            .verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(summary.title, style = MaterialTheme.typography.headlineSmall)
            Text("Private online study content", style = MaterialTheme.typography.bodySmall)
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            message?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            if (content.isNotEmpty()) Text(content, style = MaterialTheme.typography.bodyLarge)
            if (nextOffset != null && !busy) {
                Button(onClick = next, modifier = Modifier.heightIn(min = 48.dp)) {
                    Text(if (content.isEmpty()) "Try opening material" else "Read next section")
                }
            }
            if (content.isNotEmpty() && nextOffset == null) {
                Text("End of available material.", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
