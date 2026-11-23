package za.co.cabosolutions.learninghub

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * Sports and development plan drafts. The learner describes their own activity; the plan is a
 * provisional draft held in memory only and must be reviewed by a coach, teacher or guardian.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun NativeDevelopmentPlanScreen(
    draft: suspend (DevelopmentPlanRequest) -> DevelopmentPlan,
    isDemo: Boolean = false,
    close: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var area by remember { mutableStateOf("sport") }
    var activity by remember { mutableStateOf("") }
    var goal by remember { mutableStateOf("") }
    var level by remember { mutableStateOf("") }
    var strengths by remember { mutableStateOf("") }
    var focus by remember { mutableStateOf("") }
    var weeks by remember { mutableStateOf(6) }
    var plan by remember { mutableStateOf<DevelopmentPlan?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var job by remember { mutableStateOf<Job?>(null) }

    fun generate() {
        val built = NativeDevelopmentPlanRules.build(goal, weeks, area, activity, level, strengths, focus)
        val request = built.getOrElse { message = it.message; return }
        message = null
        busy = true
        job = scope.launch {
            try {
                plan = draft(request)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                message = NativeDevelopmentPlanRules.errorMessage(e)
            } finally { busy = false }
        }
    }

    Scaffold(topBar = {
        Surface(color = MaterialTheme.colorScheme.primaryContainer) {
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = { job?.cancel(); close() }, modifier = Modifier.testTag("plan-back")) { Text("Back") }
                Text("Sports & development", style = MaterialTheme.typography.titleLarge)
            }
        }
    }) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                if (isDemo) "Synthetic demo only · the sample plan is made on this device and nothing is sent to CABO."
                else "Describe an activity you do and what you want to improve. CABO drafts a practice plan for you to talk through with your coach, teacher or guardian. Plans are not saved and are not a record of achievement.",
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            val current = plan
            if (current == null) {
                Text("Area", style = MaterialTheme.typography.titleSmall)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NativeDevelopmentPlanRules.areas.forEach { value ->
                        FilterChip(selected = area == value, onClick = { area = value }, enabled = !busy,
                            label = { Text(NativeDevelopmentPlanRules.areaLabels.getValue(value)) },
                            modifier = Modifier.testTag("plan-area-$value"))
                    }
                }
                OutlinedTextField(activity, { if (it.length <= 100) activity = it }, label = { Text("Activity (for example netball)") },
                    singleLine = true, enabled = !busy, modifier = Modifier.fillMaxWidth().testTag("plan-activity"))
                OutlinedTextField(goal, { if (it.length <= 500) goal = it }, label = { Text("Your goal") },
                    enabled = !busy, minLines = 2, modifier = Modifier.fillMaxWidth().testTag("plan-goal"))
                OutlinedTextField(level, { if (it.length <= 280) level = it }, label = { Text("Where you are now (optional)") },
                    enabled = !busy, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(strengths, { if (it.length <= 450) strengths = it }, label = { Text("What already goes well (optional)") },
                    enabled = !busy, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(focus, { if (it.length <= 450) focus = it }, label = { Text("What to work on (optional)") },
                    enabled = !busy, modifier = Modifier.fillMaxWidth())
                Text("Plan length", style = MaterialTheme.typography.titleSmall)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NativeDevelopmentPlanRules.periodChoices.forEach { value ->
                        FilterChip(selected = weeks == value, onClick = { weeks = value }, enabled = !busy,
                            label = { Text("$value weeks") })
                    }
                }
                Text("Don't include health details, injuries or other people's names.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                message?.let {
                    Text(it, color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag("plan-message"))
                }
                Button(onClick = { generate() }, enabled = !busy,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("plan-generate")) {
                    Text(if (busy) "Drafting your plan…" else "Draft my plan")
                }
            } else {
                Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag("plan-result"),
                    verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(current.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    AssistChip(onClick = {}, label = {
                        Text(if (current.fromTemplate) "Starter template · not AI" else "AI draft · needs review")
                    })
                    current.warning?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    Text(current.summary, style = MaterialTheme.typography.bodyLarge)
                    current.recommendations.forEachIndexed { index, r ->
                        ElevatedCard(Modifier.fillMaxWidth().testTag("plan-recommendation-$index")) {
                            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(r.goal, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                r.steps.forEachIndexed { i, step -> Text("${i + 1}. $step") }
                                Text("How to tell it's working: ${r.measure}", style = MaterialTheme.typography.bodySmall)
                                Text("Review in week ${r.reviewWeek}", style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    Text(current.reviewNote, style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                OutlinedButton(onClick = { plan = null }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                    .testTag("plan-start-over")) { Text("Change details") }
            }
        }
    }
}
