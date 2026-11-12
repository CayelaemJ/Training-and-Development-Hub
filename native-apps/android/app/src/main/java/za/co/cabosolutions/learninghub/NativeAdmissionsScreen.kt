package za.co.cabosolutions.learninghub

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeAdmissionsScreen(api: NativeApi, close: () -> Unit) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var institutions by remember { mutableStateOf(emptyList<AdmissionInstitution>()) }
    var programmes by remember { mutableStateOf(emptyList<AdmissionProgramme>()) }
    var applications by remember { mutableStateOf(emptyList<AdmissionApplication>()) }
    var selectedInstitution by remember { mutableStateOf<Int?>(null) }
    var selectedProgramme by remember { mutableStateOf<Int?>(null) }
    var statement by remember { mutableStateOf("") }
    var references by remember { mutableStateOf<Map<Int, String>>(emptyMap()) }
    var busy by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf("") }

    fun refresh(institutionId: Int? = selectedInstitution) {
        if (busy) return
        busy = true
        scope.launch {
            try {
                institutions = api.fetchAdmissionInstitutions()
                applications = api.fetchAdmissionApplications()
                if (institutionId != null) programmes = api.fetchAdmissionProgrammes(institutionId)
                notice = if (institutions.isEmpty()) "No institutions are currently listed." else ""
            } catch (_: Exception) { notice = "Admissions are unavailable right now. Check your connection and refresh." }
            finally { busy = false }
        }
    }
    LaunchedEffect(Unit) { refresh(null) }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("CABO Apply", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Browse listed programmes and keep a private record of your application steps. CABO does not submit applications to universities or verify decisions.")
            if (notice.isNotBlank()) Text(notice, color = MaterialTheme.colorScheme.secondary, modifier = Modifier.padding(top = 8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                OutlinedButton(onClick = { refresh() }, enabled = !busy) { Text("Refresh") }
                OutlinedButton(onClick = close) { Text("Close") }
            }
        }
        item { Text("Institution directory", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
        if (busy && institutions.isEmpty()) item { CircularProgressIndicator() }
        items(institutions, key = { "admission-institution-${it.id}" }) { institution ->
            ElevatedCard(onClick = {
                if (!busy) {
                    selectedInstitution = institution.id; selectedProgramme = null; busy = true; notice = ""
                    scope.launch {
                        try { programmes = api.fetchAdmissionProgrammes(institution.id) }
                        catch (_: Exception) { programmes = emptyList(); notice = "Published programmes could not be loaded. Refresh to try again." }
                        finally { busy = false }
                    }
                }
            }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(institution.name, style = MaterialTheme.typography.titleMedium)
                    Text("${institution.province ?: "Location not provided"} · ${institution.verification.replace('_', ' ')}", style = MaterialTheme.typography.bodySmall)
                    if (selectedInstitution == institution.id) Text("Selected", color = MaterialTheme.colorScheme.primary)
                }
            }
        }
        selectedInstitution?.let { id ->
            item {
                institutions.firstOrNull { it.id == id }?.officialUrl?.takeIf { it.startsWith("https://") }?.let { link ->
                    TextButton(onClick = {
                        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) }
                            .onFailure { notice = "Could not open the official institution portal on this device." }
                    }) { Text("Open institution's official portal") }
                }
                Text("Published programmes", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                if (programmes.isEmpty() && !busy) Text("No published programmes are listed for this institution.")
            }
            items(programmes, key = { "admission-programme-${it.id}" }) { programme ->
                ElevatedCard(onClick = { selectedProgramme = programme.id }, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(programme.name, style = MaterialTheme.typography.titleMedium)
                        Text(listOfNotNull(programme.qualification, programme.faculty).filter { it.isNotBlank() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                        programme.requirements?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                        if (selectedProgramme == programme.id) Text("Selected", color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
            if (selectedProgramme != null) item {
                Text("Start a private draft", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Your statement is saved to your CABO account. Do not enter identity numbers, health information or other sensitive details.", style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(value = statement, onValueChange = { if (it.toByteArray(Charsets.UTF_8).size <= 4000) statement = it },
                    label = { Text("Application statement") }, modifier = Modifier.fillMaxWidth(), minLines = 4, maxLines = 8)
                Button(onClick = {
                    val pid = selectedProgramme ?: return@Button
                    busy = true; notice = ""
                    scope.launch {
                        try {
                            api.createAdmissionDraft(pid, statement)
                            notice = "Private draft created. CABO has not sent an application to the institution."
                            applications = api.fetchAdmissionApplications()
                        } catch (_: Exception) { notice = "Draft could not be created. It may already exist; refresh and check your applications." }
                        finally { busy = false }
                    }
                }, enabled = !busy && selectedProgramme != null) { Text("Create private draft") }
            }
        }
        item { Text("My application tracker", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
        if (applications.isEmpty()) item { Text("No applications started.") }
        items(applications, key = { "admission-application-${it.id}" }) { application ->
            ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(programmes.firstOrNull { it.id == application.programmeId }?.name ?: "Programme #${application.programmeId}", style = MaterialTheme.typography.titleMedium)
                    Text("Status: ${application.status.replace('_', ' ')}")
                    if (!application.externalReference.isNullOrBlank()) Text("Reference recorded: ${application.externalReference}", style = MaterialTheme.typography.bodySmall)
                    when (application.status) {
                        "draft" -> OutlinedButton(onClick = {
                            runUpdate(application.id, "ready_for_handoff", null, api, scope, { busy = it }, { notice = it }, { applications = it })
                        }, enabled = !busy) { Text("Mark ready for official handoff") }
                        "ready_for_handoff" -> {
                            OutlinedTextField(value = references[application.id].orEmpty(), onValueChange = { value -> references = references + (application.id to value.take(150)) },
                                label = { Text("Official portal confirmation reference") }, modifier = Modifier.fillMaxWidth())
                            OutlinedButton(onClick = {
                                val reference = references[application.id].orEmpty()
                                runUpdate(application.id, "external_submission_recorded", reference, api, scope, { busy = it }, { notice = it }, { applications = it })
                            }, enabled = !busy && references[application.id].orEmpty().trim().length >= 3) { Text("Record external submission") }
                        }
                    }
                    if (application.status in setOf("draft", "ready_for_handoff", "external_submission_recorded", "under_review")) {
                        TextButton(onClick = {
                            runUpdate(application.id, "withdrawn", null, api, scope, { busy = it }, { notice = it }, { applications = it })
                        }, enabled = !busy) { Text("Withdraw tracker record", color = MaterialTheme.colorScheme.error) }
                    }
                    Text("A recorded reference is self-reported. CABO has not verified submission or an institution decision.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

private fun runUpdate(id: Int, status: String, reference: String?, api: NativeApi,
                      scope: kotlinx.coroutines.CoroutineScope, setBusy: (Boolean) -> Unit,
                      setNotice: (String) -> Unit, setApplications: (List<AdmissionApplication>) -> Unit) {
    setBusy(true)
    scope.launch {
        try {
            api.updateAdmission(id, status, reference)
            setNotice(if (status == "ready_for_handoff") "Ready for handoff. Open the official portal to submit; CABO does not submit applications." else "Tracker updated. Institution decisions are not verified by CABO.")
            setApplications(api.fetchAdmissionApplications())
        } catch (_: Exception) { setNotice("Application status was not updated. Refresh and check the current status before retrying.") }
        finally { setBusy(false) }
    }
}
