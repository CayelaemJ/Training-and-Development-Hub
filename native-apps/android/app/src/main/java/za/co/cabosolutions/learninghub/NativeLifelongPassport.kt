package za.co.cabosolutions.learninghub

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
internal fun NativeLifelongPassportSection(api: NativeApi) {
    val scope = rememberCoroutineScope()
    var passport by remember { mutableStateOf<LifelongLearningPassport?>(null) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var learningContext by remember { mutableStateOf("lifelong") }
    var preferredLanguage by remember { mutableStateOf("") }
    var learningGoal by remember { mutableStateOf("") }
    var provider by remember { mutableStateOf("") }
    var evidenceUrl by remember { mutableStateOf("") }
    var evidenceDescription by remember { mutableStateOf("") }
    var evidenceType by remember { mutableStateOf("portfolio") }
    var skill by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("technical") }
    var masteryLevel by remember { mutableIntStateOf(0) }
    var demonstration by remember { mutableStateOf("practical") }
    var skillDescription by remember { mutableStateOf("") }
    var evidenceLinkId by remember { mutableStateOf<Int?>(null) }
    var confirmDelete by remember { mutableStateOf<Pair<Int, String>?>(null) }

    fun refresh() {
        if (busy) return
        busy = true
        message = ""
        scope.launch {
            try {
                val value = api.fetchLifelongLearningPassport()
                passport = value
                if (evidenceLinkId != null && value.links.none { it.id == evidenceLinkId }) evidenceLinkId = null
                learningContext = value.preferences.learningContext
                preferredLanguage = value.preferences.preferredLanguage
                learningGoal = value.preferences.learningGoal
            } catch (_: Exception) {
                message = "Your private Learning Passport is unavailable. Check your connection and refresh."
            } finally { busy = false }
        }
    }
    fun change(success: String, after: () -> Unit = {}, action: suspend () -> Unit) {
        if (busy) return
        busy = true
        message = ""
        scope.launch {
            try {
                action()
                val value = api.fetchLifelongLearningPassport()
                passport = value
                if (evidenceLinkId != null && value.links.none { it.id == evidenceLinkId }) evidenceLinkId = null
                after()
                message = success
            } catch (_: Exception) {
                message = "The change was not saved. Refresh and check your Learning Passport before trying again."
            } finally { busy = false }
        }
    }

    LaunchedEffect(Unit) { refresh() }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("My Learning Passport", style = MaterialTheme.typography.titleLarge)
        Text("Keep your learning goals, practical skills and public evidence links in one private record. Skills and links are self-reported; they are not verified certificates, official qualifications, or measures of intelligence or potential.",
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodySmall)
        OutlinedButton(onClick = { refresh() }, enabled = !busy) { Text("Refresh Learning Passport") }

        Text("Learning preferences", style = MaterialTheme.typography.titleMedium)
        PassportChoice("Learning context", learningContext, listOf(
            "lifelong" to "Lifelong personal learning", "adult_returning" to "Returning to education as an adult",
            "career_change" to "Preparing for a career change", "professional" to "Professional development",
            "school" to "School learning", "personal" to "Independent learning"
        )) { learningContext = it }
        OutlinedTextField(preferredLanguage, { preferredLanguage = it.take(24) }, label = { Text("Preferred language (optional)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(learningGoal, { learningGoal = it.take(2000) }, label = { Text("What would you like to learn, complete or become?") }, modifier = Modifier.fillMaxWidth(), minLines = 2, maxLines = 5)
        Button(onClick = {
            change("Learning preferences saved.") {
                api.saveLifelongLearningPreferences(LifelongLearningPreferences(learningContext, preferredLanguage, learningGoal))
            }
        }, enabled = !busy) { Text("Save preferences") }

        HorizontalDivider()
        Text("External evidence and connections", style = MaterialTheme.typography.titleMedium)
        Text("Add a public HTTPS portfolio or project link. It stays private in your account and is not scanned or shared with employers.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        passport?.links.orEmpty().forEach { link ->
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("${link.provider} · ${link.evidenceType.replace('_', ' ')} · self-reported", style = MaterialTheme.typography.titleSmall)
                    Text(link.url, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                    if (link.description.isNotBlank()) Text(link.description, style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = { confirmDelete = link.id to "link" }, enabled = !busy) { Text("Remove link") }
                }
            }
        }
        OutlinedTextField(provider, { provider = it.take(80) }, label = { Text("Website or platform") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        PassportChoice("Evidence type", evidenceType, listOf("portfolio", "project", "social", "learning", "community", "other").map { it to it.replace('_', ' ') }) { evidenceType = it }
        OutlinedTextField(evidenceUrl, { evidenceUrl = it.take(2048) }, label = { Text("Public HTTPS address") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(evidenceDescription, { evidenceDescription = it.take(2000) }, label = { Text("What does this demonstrate?") }, modifier = Modifier.fillMaxWidth(), minLines = 2, maxLines = 4)
        Button(onClick = {
            change("Private evidence link added.", after = {
                provider = ""; evidenceUrl = ""; evidenceDescription = ""
            }) {
                api.addPassportEvidenceLink(provider, evidenceUrl, evidenceDescription, evidenceType)
            }
        }, enabled = !busy && provider.trim().length >= 2 && evidenceUrl.trim().startsWith("https://")) { Text("Add evidence link") }

        HorizontalDivider()
        Text("Practical skills I can demonstrate", style = MaterialTheme.typography.titleMedium)
        Text("Describe work you really completed. The level applies only to the evidence for that skill and is not a judgement of your ability.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        passport?.competencies.orEmpty().forEach { item ->
            ElevatedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(item.skill, style = MaterialTheme.typography.titleSmall)
                    Text("${item.category} · ${passportMasteryLabels[item.masteryLevel]} · self-reported", style = MaterialTheme.typography.bodySmall)
                    Text(item.description, style = MaterialTheme.typography.bodyMedium)
                    Text("Demonstrated through ${item.demonstration.replace('_', ' ')}", style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = { confirmDelete = item.id to "skill" }, enabled = !busy) { Text("Remove skill") }
                }
            }
        }
        OutlinedTextField(skill, { skill = it.take(120) }, label = { Text("Skill") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        PassportChoice("Skill category", category, listOf("technical", "academic", "creative", "vocational", "transferable", "other").map { it to it }) { category = it }
        PassportChoice("Evidence-based self-assessment", masteryLevel.toString(), passportMasteryLabels.mapIndexed { index, label -> index.toString() to label }) { masteryLevel = it.toIntOrNull() ?: 0 }
        PassportChoice("How did you demonstrate it?", demonstration, listOf("practical", "project", "assessment", "portfolio", "work_example", "reflection", "other").map { it to it.replace('_', ' ') }) { demonstration = it }
        val links = passport?.links.orEmpty()
        if (links.isNotEmpty()) PassportChoice("Supporting evidence (optional)", evidenceLinkId?.toString() ?: "none",
            listOf("none" to "No linked evidence") + links.map { it.id.toString() to "${it.provider} · ${it.url.take(48)}" }) { evidenceLinkId = it.toIntOrNull() }
        OutlinedTextField(skillDescription, { skillDescription = it.take(3000) }, label = { Text("What did you make, solve, do or explain?") }, modifier = Modifier.fillMaxWidth(), minLines = 3, maxLines = 7)
        Button(onClick = {
            change("Practical skill evidence recorded privately.", after = {
                skill = ""; skillDescription = ""; evidenceLinkId = null
            }) {
                api.addPassportCompetency(skill, category, masteryLevel, demonstration, skillDescription, evidenceLinkId)
            }
        }, enabled = !busy && skill.trim().length >= 2 && skillDescription.trim().length >= 10) { Text("Record skill evidence") }
    }
    confirmDelete?.let { (id, kind) ->
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text(if (kind == "link") "Remove this evidence link?" else "Remove this skill record?") },
            text = { Text("This removes the item from your private Learning Passport. It does not affect school or official records.") },
            confirmButton = { TextButton(onClick = {
                val target = confirmDelete ?: return@TextButton
                confirmDelete = null
                change("Item removed from your private Learning Passport.") {
                    if (target.second == "link") api.deletePassportEvidenceLink(target.first)
                    else api.deletePassportCompetency(target.first)
                }
            }) { Text("Remove") } },
            dismissButton = { TextButton(onClick = { confirmDelete = null }) { Text("Cancel") } }
        )
    }
}

private val passportMasteryLabels = listOf(
    "0 · Not yet demonstrated (not a judgement of ability)",
    "1 · Exploring with guidance", "2 · Developing with some assistance",
    "3 · Independent demonstration", "4 · Applies the skill in new situations"
)

@Composable
private fun PassportChoice(label: String, selected: String, options: List<Pair<String, String>>, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Box {
            OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                Text(options.firstOrNull { it.first == selected }?.second ?: selected)
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { (value, title) ->
                    DropdownMenuItem(text = { Text(title) }, onClick = { onSelect(value); expanded = false })
                }
            }
        }
    }
}
