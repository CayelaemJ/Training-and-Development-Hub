package za.co.cabosolutions.learninghub

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.security.MessageDigest
import java.security.SecureRandom
import android.util.Base64
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

private const val MAX_MATERIAL_BYTES = 30L * 1024 * 1024
private val materialContentTypes = mapOf(
    "txt" to "text/plain", "md" to "text/markdown", "csv" to "text/csv",
    "pdf" to "application/pdf",
    "docx" to "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx" to "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx" to "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "png" to "image/png", "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "webp" to "image/webp"
)

internal data class MaterialSummary(val id: Int, val title: String)
internal data class LearnerJourneyIdentity(val displayName: String = "")
internal data class LearnerJourneyEntry(val id: Int, val institutionName: String, val stage: String, val academicYear: Int, val note: String)
internal data class LearnerJourneyMilestone(val id: Int, val title: String, val description: String, val kind: String, val year: Int)
internal sealed class LearnerJourneyAction {
    data class SaveIdentity(val displayName: String) : LearnerJourneyAction()
    data class AddEntry(val institution: String, val stage: String, val year: Int, val note: String) : LearnerJourneyAction()
    data class AddMilestone(val title: String, val description: String, val kind: String, val year: Int) : LearnerJourneyAction()
    data class DeleteEntry(val id: Int) : LearnerJourneyAction()
    data class DeleteMilestone(val id: Int) : LearnerJourneyAction()
}
internal data class SupportCourseOption(val organizationId: Int, val courseId: Int, val name: String)
internal data class NativeSupportDraft(
    val requestKey: String, val organizationId: Int, val courseId: Int,
    val courseName: String, val concept: String, val question: String, val attempted: String
)
internal data class QuizSummary(val id: Int, val title: String, val questionCount: Int, val latestScore: Double?)
internal data class QuizQuestion(val prompt: String, val options: List<String>)
internal data class PracticeQuiz(val id: Int, val title: String, val questions: List<QuizQuestion>)
internal data class QuizFeedback(val questionIndex: Int, val isCorrect: Boolean, val explanation: String)
internal data class QuizAttempt(val id: Int, val quizId: Int, val correctCount: Int,
    val totalQuestions: Int, val percentage: Double, val feedback: List<QuizFeedback>)
internal data class MaterialPage(val id: Int, val title: String, val text: String,
    val offset: Int, val nextOffset: Int?)

internal data class NativePortal(val role: String, val summary: List<String>, val areas: List<String>)
internal data class GuardianInvite(
    val id: Int, val status: String, val learnerName: String?, val verified: Boolean
)
internal data class GuardianSubject(val name: String, val percentage: Double, val assessmentCount: Int)
internal data class GuardianAcademicReport(
    val learnerId: String, val learnerName: String, val organizationId: Int,
    val year: Int, val grade: String, val average: Double?,
    val subjects: List<GuardianSubject>, val attendanceRate: Int?,
    val presentDays: Int, val recordedDays: Int, val official: Boolean
) {
    val id: String get() = "$learnerId:$organizationId:$year"
}
internal data class LearnerAcademicReport(
    val organizationId: Int, val year: Int, val grade: String, val average: Double?,
    val subjects: List<GuardianSubject>, val attendanceRate: Int?,
    val presentDays: Int, val recordedDays: Int
) { val id: String get() = "$organizationId:$year" }
internal data class StaffWorkspace(
    val organizationId: Int, val courses: List<String>, val supportSummary: List<String>,
    val tickets: List<SupportTicketSummary>, val notice: String?
)
internal data class SupportTicketSummary(
    val organizationId: Int,
    val id: Int,
    val concept: String,
    val status: String,
    val version: Int,
    val updatedAt: String,
    val assignedTo: String? = null,
    val reviewAt: String? = null,
    val feedback: String? = null
)
internal data class SupportEducator(val id: String, val name: String)
internal data class SupportTicket(
    val summary: SupportTicketSummary,
    val question: String,
    val attempted: String,
    val history: List<SupportTicketEvent>,
    val educators: List<SupportEducator> = emptyList(),
    val publishedResults: List<SupportPublishedResult> = emptyList(),
    val outcome: SupportOutcome? = null
)
internal data class SupportPublishedResult(val id: Int, val title: String, val marks: Double, val maxMarks: Double, val updatedAt: String)
internal data class SupportOutcome(val baseline: Double, val followup: Double, val improvementPp: Double, val comparisonReason: String?)
internal data class SupportTicketEvent(val kind: String, val body: String, val createdAt: String, val state: String? = null)
internal data class SupportGuidanceDraft(
    val explanation: String,
    val questions: List<String>,
    val practice: List<String>,
    val source: String
)
internal data class NativeLearning(
    val portal: NativePortal,
    val materials: List<String>,
    val quizzes: List<String>,
    val guardians: List<GuardianInvite> = emptyList(),
    val parentGuidance: String = "",
    val parentReports: List<GuardianAcademicReport> = emptyList(),
    val parentReportNotice: String = "",
    val staff: List<StaffWorkspace> = emptyList(),
    val journey: List<String> = emptyList(),
    val journeyIdentity: LearnerJourneyIdentity = LearnerJourneyIdentity(),
    val journeyEntries: List<LearnerJourneyEntry> = emptyList(),
    val journeyMilestones: List<LearnerJourneyMilestone> = emptyList(),
    val learnerHelp: List<String> = emptyList(),
    val learnerSupportTickets: List<SupportTicketSummary> = emptyList(),
    val materialEntries: List<MaterialSummary> = emptyList(),
    val supportCourses: List<SupportCourseOption> = emptyList(),
    val supportDrafts: List<NativeSupportDraft> = emptyList(),
    val quizEntries: List<QuizSummary> = emptyList(),
    val adminOrganizations: List<String> = emptyList(),
    val learnerReports: List<LearnerAcademicReport> = emptyList(),
    val learnerReportNotice: String = ""
)

internal class NativeApi(private val context: Context) {
    private val secrets = NativeSecrets(context)
    private val origin = BuildConfig.API_ORIGIN.trimEnd('/')
    private val clientId = "cabo-android"
    private val callbackScheme = "cabo-learninghub-android"

    private fun random(): String {
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
    private fun sha256Base64Url(value: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
    fun testLoginAvailable(): Boolean = BuildConfig.ENABLE_TEST_LOGIN

    private fun supportDraftOwner(): String {
        val token = secrets.get("token") ?: throw IllegalStateException("Sign in required")
        return Base64.encodeToString(MessageDigest.getInstance("SHA-256")
            .digest(token.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
    }

    suspend fun loadSupportDrafts(): List<NativeSupportDraft> =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val owner = supportDraftOwner()
            if (secrets.get("support_drafts_owner") != owner) {
                secrets.put("support_drafts", null)
                secrets.put("support_courses", null)
                secrets.put("support_drafts_owner", owner)
                return@withContext emptyList()
            }
            val saved = secrets.get("support_drafts") ?: return@withContext emptyList()
            val rows = JSONArray(saved)
            (0 until rows.length()).mapNotNull { index ->
                val row = rows.optJSONObject(index) ?: return@mapNotNull null
                val key = row.optString("requestKey")
                val orgId = row.optInt("organizationId")
                val courseId = row.optInt("courseId")
                val name = row.optString("courseName")
                val concept = row.optString("concept")
                val question = row.optString("question")
                val attempted = row.optString("attempted")
                if (key.isBlank() || orgId <= 0 || courseId <= 0 || name.isBlank() ||
                    concept.length !in 2..160 || question.length !in 10..4000 || attempted.length !in 3..2000) null
                else NativeSupportDraft(key, orgId, courseId, name, concept, question, attempted)
            }.take(20)
        }

    suspend fun loadCachedSupportCourses(): List<SupportCourseOption> =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val owner = try { supportDraftOwner() } catch (_: Exception) { return@withContext emptyList() }
            if (secrets.get("support_drafts_owner") != owner) return@withContext emptyList()
            val rows = try { JSONArray(secrets.get("support_courses") ?: return@withContext emptyList()) }
                catch (_: Exception) { return@withContext emptyList() }
            (0 until rows.length()).mapNotNull { index ->
                val row = rows.optJSONObject(index) ?: return@mapNotNull null
                val orgId = row.optInt("organizationId")
                val courseId = row.optInt("courseId")
                val name = row.optString("name").take(120)
                if (orgId <= 0 || courseId <= 0 || name.isBlank()) null
                else SupportCourseOption(orgId, courseId, name)
            }.take(100)
        }

    suspend fun saveSupportDraft(draft: NativeSupportDraft): List<NativeSupportDraft> =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(draft.requestKey.matches(Regex("[a-fA-F0-9-]{36}")) && draft.organizationId > 0 && draft.courseId > 0)
            require(draft.concept.trim().length in 2..160 && draft.question.trim().length in 10..4000 &&
                draft.attempted.trim().length in 3..2000)
            val current = loadSupportDrafts().filterNot { it.requestKey == draft.requestKey }
            val updated = (current + draft.copy(concept = draft.concept.trim(), question = draft.question.trim(),
                attempted = draft.attempted.trim())).takeLast(20)
            val rows = JSONArray()
            updated.forEach { row -> rows.put(JSONObject()
                .put("requestKey", row.requestKey).put("organizationId", row.organizationId)
                .put("courseId", row.courseId).put("courseName", row.courseName)
                .put("concept", row.concept).put("question", row.question).put("attempted", row.attempted)) }
            secrets.put("support_drafts_owner", supportDraftOwner())
            secrets.put("support_drafts", rows.toString())
            updated
        }

    suspend fun deleteSupportDraft(requestKey: String): List<NativeSupportDraft> =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val updated = loadSupportDrafts().filterNot { it.requestKey == requestKey }
            val rows = JSONArray()
            updated.forEach { row -> rows.put(JSONObject()
                .put("requestKey", row.requestKey).put("organizationId", row.organizationId)
                .put("courseId", row.courseId).put("courseName", row.courseName)
                .put("concept", row.concept).put("question", row.question).put("attempted", row.attempted)) }
            secrets.put("support_drafts", rows.toString())
            updated
        }

    suspend fun clearSupportDrafts() = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        secrets.put("support_drafts", null)
        secrets.put("support_courses", null)
        secrets.put("support_drafts_owner", null)
    }

    suspend fun submitSupportDraft(draft: NativeSupportDraft): Int =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val response = request("/api/organizations/${draft.organizationId}/support", JSONObject()
                .put("courseId", draft.courseId).put("concept", draft.concept)
                .put("question", draft.question).put("attempted", draft.attempted)
                .put("requestKey", draft.requestKey), auth = true)
            response.getInt("id").also { require(it > 0) { "CABO returned an invalid support request." } }
        }

    suspend fun materialFileName(uri: Uri): String =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val displayName = context.contentResolver.query(
                uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null
            )?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
            (displayName ?: uri.lastPathSegment ?: "study-material")
                .replace('\\', '/')
                .substringAfterLast('/')
                .filterNot { it.isISOControl() }
                .take(240)
                .ifBlank { "study-material" }
        }

    suspend fun uploadMaterial(uri: Uri, title: String): MaterialSummary =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val safeTitle = title.trim()
            require(safeTitle.isNotEmpty() && safeTitle.length <= 200) {
                "Enter a title of 1 to 200 characters."
            }
            val fileName = materialFileName(uri)
            val extension = fileName.substringAfterLast('.', "").lowercase()
            val contentType = materialContentTypes[extension]
                ?: throw IllegalArgumentException("Choose a supported PDF, Office, text, CSV, PNG, JPEG or WebP file.")
            val staged = File.createTempFile("cabo-material-", ".upload", context.cacheDir)
            try {
                val input = context.contentResolver.openInputStream(uri)
                    ?: throw IllegalArgumentException("Could not open the selected document.")
                var total = 0L
                input.use { source -> FileOutputStream(staged).use { target ->
                    val buffer = ByteArray(16 * 1024)
                    while (true) {
                        val count = source.read(buffer)
                        if (count < 0) break
                        total += count
                        require(total <= MAX_MATERIAL_BYTES) { "Files must be 30 MB or smaller." }
                        target.write(buffer, 0, count)
                    }
                } }
                require(total > 0) { "The selected document is empty." }

                val intent = request("/api/storage/uploads/request-url", JSONObject()
                    .put("name", fileName)
                    .put("size", total)
                    .put("contentType", contentType)
                    .put("allowAiReading", false), auth = true)
                val targetUrl = URL(intent.getString("uploadURL"))
                val targetUri = URI(targetUrl.toExternalForm())
                val apiUrl = URL(origin)
                require(targetUrl.protocol == "https" && targetUri.userInfo == null) {
                    "CABO returned an invalid secure upload destination."
                }
                val sameApiHost = targetUrl.host.equals(apiUrl.host, ignoreCase = true)
                val sameApiAuthority = sameApiHost &&
                    (targetUrl.port.takeIf { it >= 0 } ?: targetUrl.defaultPort) ==
                    (apiUrl.port.takeIf { it >= 0 } ?: apiUrl.defaultPort)
                val nativeTestPath = sameApiAuthority &&
                    targetUrl.path.matches(Regex("/api/storage/uploads/railway/[a-f0-9-]{36}"))
                if (sameApiHost && !nativeTestPath) {
                    throw IllegalStateException("CABO returned an unexpected upload destination.")
                }
                val upload = targetUrl.openConnection() as HttpURLConnection
                upload.connectTimeout = 15_000
                upload.readTimeout = 30_000
                upload.instanceFollowRedirects = false
                upload.requestMethod = "PUT"
                upload.doOutput = true
                upload.useCaches = false
                upload.setRequestProperty("Content-Type", contentType)
                // The isolated Render test fallback is an authenticated API route.
                // Never send the CABO bearer token to external signed storage URLs.
                if (nativeTestPath) {
                    val token = secrets.get("token") ?: throw IllegalStateException("Sign in required")
                    upload.setRequestProperty("Authorization", "Bearer $token")
                }
                upload.setFixedLengthStreamingMode(total)
                try {
                    FileInputStream(staged).use { source -> upload.outputStream.use { target ->
                        val buffer = ByteArray(16 * 1024)
                        while (true) {
                            val count = source.read(buffer)
                            if (count < 0) break
                            target.write(buffer, 0, count)
                        }
                    } }
                    val status = upload.responseCode
                    require(status in 200..299) { "The file upload was not accepted. Please retry." }
                } finally {
                    upload.disconnect()
                }

                val saved = request("/api/materials", JSONObject()
                    .put("title", safeTitle)
                    .put("objectPath", intent.getString("objectPath")), auth = true)
                val id = saved.getInt("id")
                val savedTitle = saved.getString("title")
                require(id > 0 && savedTitle.isNotBlank()) { "CABO returned an invalid material record." }
                MaterialSummary(id, savedTitle)
            } finally {
                staged.delete()
            }
        }

    // Explicitly enabled in private, disposable test builds only. The
    // password stays in memory for this single HTTPS request, not on disk.
    suspend fun testLogin(username: String, password: String): String =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            if (!BuildConfig.ENABLE_TEST_LOGIN) return@withContext "Not a test build."
            if (username != "cabo_test" || password.isEmpty())
                return@withContext "Enter the CABO test username and password."
            try {
                val json = request("/api/native/test-login", JSONObject()
                    .put("username", username).put("password", password))
                val token = json.getString("access_token")
                val seconds = json.getInt("expires_in")
                require(json.optString("token_type") == "Bearer" &&
                    token.length >= 32 && seconds in 1..3600)
                secrets.put("token", token)
                "CABO test account signed in."
            } catch (_: Exception) {
                "Test sign-in failed. Verify the isolated test server and credentials."
            }
        }

    fun hasSession(): Boolean = secrets.get("token") != null
    fun authorize(): Intent {
        val verifier = random()
        val state = random()
        secrets.put("verifier", verifier)
        secrets.put("state", state)
        val uri = Uri.parse("$origin/api/native/authorize").buildUpon()
            .appendQueryParameter("client_id", clientId)
            .appendQueryParameter("code_challenge", sha256Base64Url(verifier))
            .appendQueryParameter("code_challenge_method", "S256")
            .appendQueryParameter("state", state).build()
        return Intent(Intent.ACTION_VIEW, uri)
    }
    suspend fun complete(intent: Intent): String = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        val data = intent.data
        if (data?.scheme != callbackScheme || data.host != "auth" || data.path.orEmpty() !in listOf("", "/")) {
            return@withContext "Invalid CABO sign-in callback"
        }
        val code = data.getQueryParameter("code")
        val state = data.getQueryParameter("state")
        val expected = secrets.get("state")
        val verifier = secrets.get("verifier")
        secrets.clearChallenge()
        if (code.isNullOrEmpty() || state.isNullOrEmpty() || expected.isNullOrEmpty() || verifier.isNullOrEmpty() || state != expected) {
            return@withContext "Sign-in expired or was interrupted. Please try again."
        }
        return@withContext try {
            val json = request("/api/native/token", body = JSONObject()
                .put("client_id", clientId).put("code", code).put("code_verifier", verifier))
            val token = json.getString("access_token")
            val seconds = json.optInt("expires_in")
            if (json.optString("token_type") != "Bearer" || token.length < 32 || seconds !in 1..3600) {
                "CABO returned an unexpected sign-in response."
            } else {
                secrets.put("token", token)
                "Signed in to CABO"
            }
        } catch (_: Exception) { "Native sign-in could not complete. Please try again." }
    }
    private fun request(route: String, body: JSONObject? = null, method: String? = null,
                        auth: Boolean = false, requestKey: String? = null): JSONObject {
        val url = URL(origin + route)
        val connection = url.openConnection() as HttpURLConnection
        connection.connectTimeout = 9000
        connection.readTimeout = 9000
        connection.instanceFollowRedirects = false
        connection.useCaches = false
        connection.setRequestProperty("Accept", "application/json")
        if (requestKey != null) connection.setRequestProperty("Idempotency-Key", requestKey)
        if (auth) {
            val token = secrets.get("token") ?: throw IllegalStateException("Sign in required")
            connection.setRequestProperty("Authorization", "Bearer $token")
        }
        connection.requestMethod = method ?: if (body != null) "POST" else "GET"
        if (body != null) {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
        }
        try {
            if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            if (status !in 200..299) {
                if (status == 401) { secrets.clearSession(); throw IllegalStateException("Session expired") }
                throw IllegalStateException("CABO API HTTP $status")
            }
            val text = connection.inputStream.bufferedReader().use { it.readText() }
            return if (text.isBlank()) JSONObject() else JSONObject(text)
        } finally { connection.disconnect() }
    }
    private fun getArray(route: String): JSONArray {
        val token = secrets.get("token") ?: throw IllegalStateException("Sign in required")
        val connection = URL(origin + route).openConnection() as HttpURLConnection
        connection.connectTimeout = 9000
        connection.readTimeout = 9000
        connection.instanceFollowRedirects = false
        connection.useCaches = false
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("Authorization", "Bearer $token")
        try {
            val status = connection.responseCode
            if (status == 401) { secrets.clearSession(); throw IllegalStateException("Session expired") }
            if (status !in 200..299) throw IllegalStateException("CABO API HTTP $status")
            return JSONArray(connection.inputStream.bufferedReader().use { it.readText() })
        } finally { connection.disconnect() }
    }
    suspend fun dashboard(): NativeLearning = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        val json = request("/api/portal/me", auth = true)
        val role = json.optString("role", "learner")
        val summary = json.optJSONObject("summary")?.let { obj ->
            obj.keys().asSequence().map { key -> "$key: ${obj.optInt(key)}" }.toList()
        } ?: emptyList()
        val cards = json.optJSONArray("cards")?.let { arr ->
            (0 until arr.length()).mapNotNull { index -> arr.optJSONObject(index)?.optString("label") }
        } ?: emptyList()
        val orgIds = json.optJSONArray("organizationIds")?.let { arr ->
            (0 until arr.length()).mapNotNull { i -> arr.optInt(i).takeIf { it > 0 } }.distinct().take(12)
        } ?: emptyList()

        // Role is resolved by CABO on the server. Device size is presentation
        // only, never a permission to access another person's information.
        if (role == "superadmin") {
            // Audited, backend-authorized registry only; no learner PII.
            val json = request("/api/platform/overview", auth = true)
            val items = json.optJSONArray("organizations") ?: JSONArray()
            val names = (0 until minOf(items.length(), 100)).mapNotNull { i ->
                items.optJSONObject(i)?.optString("name")?.takeIf { it.isNotBlank() }
            }
            return@withContext NativeLearning(
                NativePortal(role, summary, cards), emptyList(), emptyList(),
                adminOrganizations = names
            )
        }

        if (role == "parent") {
            val response = request("/api/native/mobile/parent", auth = true)
            val arr = response.optJSONArray("relationships") ?: JSONArray()
            val relationships = (0 until arr.length()).mapNotNull { i ->
                val item = arr.optJSONObject(i) ?: return@mapNotNull null
                GuardianInvite(item.optInt("invitationId"), item.optString("status"),
                    item.optString("learnerName").takeUnless { it.isBlank() || it == "null" },
                    item.optBoolean("verifiedForRead"))
            }
            var notice = "Verified progress reports are unavailable right now."
            val reports = try {
                val payload = request("/api/native/mobile/parent/reports", auth = true)
                notice = payload.optString("guidance")
                val rows = payload.optJSONArray("reports") ?: JSONArray()
                (0 until minOf(rows.length(), 20)).mapNotNull { i ->
                    val row = rows.optJSONObject(i) ?: return@mapNotNull null
                    val id = row.optString("learnerId")
                    val org = row.optInt("organizationId")
                    if (id.isBlank() || org <= 0) return@mapNotNull null
                    val scores = row.optJSONArray("subjects") ?: JSONArray()
                    val subjects = (0 until scores.length()).mapNotNull { j ->
                        val score = scores.optJSONObject(j) ?: return@mapNotNull null
                        GuardianSubject(score.optString("name"), score.optDouble("percentage"),
                            score.optInt("assessmentCount"))
                    }
                    val attendance = row.optJSONObject("attendance") ?: JSONObject()
                    GuardianAcademicReport(
                        id, row.optString("learnerName"), org,
                        row.optInt("year"), row.optString("grade"),
                        if (row.isNull("average")) null else row.optDouble("average"),
                        subjects,
                        if (attendance.isNull("rate")) null else attendance.optInt("rate"),
                        attendance.optInt("presentDays"), attendance.optInt("recordedDays"),
                        row.optBoolean("official")
                    )
                }
            } catch (error: Exception) {
                if (!hasSession()) throw error
                emptyList()
            }
            return@withContext NativeLearning(
                NativePortal(role, summary, cards), emptyList(), emptyList(),
                guardians = relationships, parentGuidance = response.optString("guidance"),
                parentReports = reports, parentReportNotice = notice
            )
        }

        if (role in listOf("teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head")) {
            val workspace = orgIds.map { orgId ->
                try {
                    val response = request("/api/organizations/$orgId/support/options", auth = true)
                    val courses = response.optJSONArray("courses") ?: JSONArray()
                    val courseNames = (0 until courses.length()).mapNotNull { i ->
                        courses.optJSONObject(i)?.optString("name")?.takeIf { it.isNotBlank() }
                    }
                    val stats = try {
                        val obj = request("/api/organizations/$orgId/support/accountability", auth = true)
                            .optJSONObject("summary")
                        obj?.keys()?.asSequence()?.map { key -> "$key: ${obj.optInt(key)}" }?.toList()
                            ?: emptyList()
                    } catch (error: Exception) {
                        if (!hasSession()) throw error
                        emptyList()
                    }
                    val supportTickets = try {
                        val response = request("/api/organizations/$orgId/support", auth = true)
                        val tickets = response.optJSONArray("items") ?: JSONArray()
                        (0 until minOf(tickets.length(), 20)).mapNotNull { index ->
                            tickets.optJSONObject(index)?.let { row ->
                                val ticketId = row.optInt("id")
                                val topic = row.optString("concept").take(160)
                                if (ticketId <= 0 || topic.isBlank()) null else SupportTicketSummary(
                                    organizationId = orgId,
                                    id = ticketId,
                                    concept = topic,
                                    status = row.optString("status", "open").take(32),
                                    version = row.optInt("version", 1).coerceAtLeast(1),
                                    updatedAt = row.optString("updatedAt")
                                )
                            }
                        }
                    } catch (error: Exception) {
                        if (!hasSession()) throw error
                        emptyList()
                    }
                    StaffWorkspace(orgId, courseNames, stats, supportTickets, null)
                } catch (error: Exception) {
                    if (!hasSession()) throw error
                    StaffWorkspace(orgId, emptyList(), emptyList(), emptyList(),
                        "School support data is unavailable. This may not be enabled for your institution.")
                }
            }
            return@withContext NativeLearning(
                NativePortal(role, summary, cards), emptyList(), emptyList(), staff = workspace
            )
        }

        val materialEntries = try {
            getArray("/api/materials").let { arr ->
                (0 until arr.length()).mapNotNull { i ->
                    val row = arr.optJSONObject(i) ?: return@mapNotNull null
                    val id = row.optInt("id")
                    val title = row.optString("title")
                    if (id > 0 && title.isNotBlank()) MaterialSummary(id, title) else null
                }.take(30)
            }
        } catch (error: Exception) {
            if (!hasSession()) throw error
            emptyList()
        }
        val quizEntries = try {
            getArray("/api/quizzes").let { arr ->
                (0 until arr.length()).mapNotNull { i ->
                    val row = arr.optJSONObject(i) ?: return@mapNotNull null
                    val id = row.optInt("id")
                    val title = row.optString("title")
                    if (id <= 0 || title.isBlank()) null else QuizSummary(
                        id, title, row.optInt("questionCount"),
                        if (row.isNull("latestScore")) null else row.optDouble("latestScore")
                    )
                }.take(30)
            }
        } catch (error: Exception) {
            if (!hasSession()) throw error
            emptyList()
        }
        var learnerReportNotice = ""
        val learnerReports = orgIds.take(5).mapNotNull { orgId ->
            try {
                val year = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)
                val response = request("/api/reports/me?organizationId=$orgId&year=$year", auth = true)
                val attendance = response.optJSONObject("attendance") ?: JSONObject()
                val subjects = response.optJSONArray("subjects") ?: JSONArray()
                val rows = (0 until subjects.length()).mapNotNull { j ->
                    val subj = subjects.optJSONObject(j) ?: return@mapNotNull null
                    val name = subj.optString("name")
                    if (name.isBlank()) null else GuardianSubject(
                        name, subj.optDouble("percentage"), subj.optInt("assessmentCount")
                    )
                }
                LearnerAcademicReport(
                    orgId, response.optInt("year", year), response.optString("grade"),
                    if (response.isNull("average")) null else response.optDouble("average"),
                    rows,
                    if (attendance.isNull("rate")) null else attendance.optInt("rate"),
                    attendance.optInt("presentDays"), attendance.optInt("recordedDays")
                )
            } catch (error: Exception) {
                if (!hasSession()) throw error
                learnerReportNotice = "Some academic reports could not be loaded."
                null
            }
        }
        var journeyIdentity = LearnerJourneyIdentity()
        var journeyEntries = emptyList<LearnerJourneyEntry>()
        var journeyMilestones = emptyList<LearnerJourneyMilestone>()
        val journey = try {
            val obj = request("/api/learner-journey/me", auth = true)
            val stages = obj.optJSONArray("journeys") ?: JSONArray()
            val milestones = obj.optJSONArray("milestones") ?: JSONArray()
            journeyIdentity = LearnerJourneyIdentity(obj.optJSONObject("identity")?.optString("displayName", "")?.take(160) ?: "")
            journeyEntries = (0 until minOf(stages.length(), 100)).mapNotNull { i ->
                stages.optJSONObject(i)?.let { row ->
                    val id = row.optInt("id"); val school = row.optString("institutionName")
                    if (id <= 0 || school.isBlank()) null else LearnerJourneyEntry(id,
                        school.take(160), row.optString("stage").take(32), row.optInt("academicYear"), row.optString("note").take(2000))
                }
            }
            journeyMilestones = (0 until minOf(milestones.length(), 100)).mapNotNull { i ->
                milestones.optJSONObject(i)?.let { row ->
                    val id = row.optInt("id"); val title = row.optString("title"); val detail = row.optString("description")
                    if (id <= 0 || title.isBlank() || detail.isBlank()) null else LearnerJourneyMilestone(
                        id, title.take(160), detail.take(4000), row.optString("kind").take(32), row.optInt("year"))
                }
            }
            listOf("Learning stages: ${stages.length()}", "Milestones: ${milestones.length()}")
        } catch (error: Exception) {
            if (!hasSession()) throw error
            emptyList()
        }
        val supportCourses = if (role == "learner") orgIds.take(12).flatMap { orgId ->
            try {
                val response = request("/api/organizations/$orgId/support/options", auth = true)
                val courses = response.optJSONArray("courses") ?: JSONArray()
                (0 until courses.length()).mapNotNull { i -> courses.optJSONObject(i)?.let { row ->
                    val id = row.optInt("id")
                    val name = row.optString("name").trim().take(120)
                    if (id > 0 && name.isNotBlank()) SupportCourseOption(orgId, id, name) else null
                } }
            } catch (error: Exception) {
                if (!hasSession()) throw error
                emptyList()
            }
        }.take(100) else emptyList()
        val cachedCourses = JSONArray()
        supportCourses.forEach { course -> cachedCourses.put(JSONObject()
            .put("organizationId", course.organizationId).put("courseId", course.courseId)
            .put("name", course.name)) }
        secrets.put("support_drafts_owner", supportDraftOwner())
        secrets.put("support_courses", cachedCourses.toString())
        val learnerSupportTickets = if (role == "learner") orgIds.take(3).flatMap { orgId ->
            try {
                val response = request("/api/organizations/$orgId/support", auth = true)
                val tickets = response.optJSONArray("items") ?: JSONArray()
                (0 until minOf(tickets.length(), 15)).mapNotNull { i ->
                    tickets.optJSONObject(i)?.let { row ->
                        val id = row.optInt("id"); val courseId = row.optInt("courseId")
                        val concept = row.optString("concept").trim(); val status = row.optString("status")
                        val version = row.optInt("version"); val updated = row.optString("updatedAt")
                        if (id <= 0 || courseId <= 0 || concept.isBlank() || status.isBlank() || version <= 0) null
                        else SupportTicketSummary(orgId, id, concept.take(160), status.take(32), version,
                            updated.take(40), reviewAt = row.optString("reviewAt").takeIf { it.isNotBlank() && it != "null" },
                            feedback = row.optString("feedback").takeIf { it.isNotBlank() && it != "null" })
                    }
                }
            } catch (error: Exception) {
                if (!hasSession()) throw error
                emptyList()
            }
        }.take(30) else emptyList()
        val learnerHelp = learnerSupportTickets.map { "${it.concept} · ${it.status.replace('_', ' ')}" }
        NativeLearning(NativePortal(role, summary, cards), materialEntries.map { it.title },
            quizEntries.map { it.title }, journey = journey, learnerHelp = learnerHelp,
            learnerSupportTickets = learnerSupportTickets, materialEntries = materialEntries, supportCourses = supportCourses, quizEntries = quizEntries,
            journeyIdentity = journeyIdentity, journeyEntries = journeyEntries, journeyMilestones = journeyMilestones,
            learnerReports = learnerReports, learnerReportNotice = learnerReportNotice)
    }

    suspend fun saveJourneyIdentity(displayName: String) = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        request("/api/learner-journey/me", JSONObject().put("displayName", displayName.trim().take(160)), method = "PUT", auth = true)
    }

    suspend fun addJourneyEntry(institutionName: String, stage: String, academicYear: Int, note: String) =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            request("/api/learner-journey/entries", JSONObject().put("institutionName", institutionName.trim())
                .put("stage", stage).put("academicYear", academicYear).put("note", note.take(2000)), auth = true)
        }

    suspend fun addJourneyMilestone(title: String, description: String, kind: String, year: Int) =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            request("/api/learner-journey/milestones", JSONObject().put("title", title.trim())
                .put("description", description.trim()).put("kind", kind).put("year", year), auth = true)
        }

    suspend fun deleteJourneyItem(path: String) = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        require(path.matches(Regex("/api/learner-journey/(entries|milestones)/[1-9][0-9]*")))
        request(path, method = "DELETE", auth = true)
    }

    suspend fun fetchSupportTicket(summary: SupportTicketSummary): SupportTicket =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(summary.organizationId > 0 && summary.id > 0)
            val json = request(
                "/api/organizations/${summary.organizationId}/support/${summary.id}", auth = true
            )
            val ticket = json.getJSONObject("ticket")
            require(ticket.optInt("id") == summary.id &&
                ticket.optInt("organizationId") == summary.organizationId)
            val canonical = summary.copy(
                status = ticket.optString("status", summary.status).take(32),
                version = ticket.optInt("version", summary.version).coerceAtLeast(1),
                updatedAt = ticket.optString("updatedAt", summary.updatedAt),
                assignedTo = ticket.optString("assignedTo").takeIf { it.isNotBlank() && it != "null" },
                reviewAt = ticket.optString("reviewAt").takeIf { it.isNotBlank() && it != "null" },
                feedback = ticket.optString("feedback").takeIf { it.isNotBlank() && it != "null" }
            )
            val events = json.optJSONArray("history") ?: JSONArray()
            val educatorsJson = json.optJSONArray("educators") ?: JSONArray()
            val educators = (0 until minOf(educatorsJson.length(), 100)).mapNotNull { i ->
                educatorsJson.optJSONObject(i)?.let { row ->
                    val id = row.optString("id"); val name = listOf(row.optString("firstName"), row.optString("lastName"))
                        .filter { it.isNotBlank() && it != "null" }.joinToString(" ")
                    if (id.isBlank() || id == "null") null else SupportEducator(id, name.ifBlank { "School educator" })
                }
            }
            val history = (0 until minOf(events.length(), 500)).mapNotNull { index ->
                events.optJSONObject(index)?.let { event ->
                    val body = event.optString("body").take(4000)
                    if (body.isBlank()) null else SupportTicketEvent(
                        kind = event.optString("kind", "update").take(32),
                        body = body,
                        createdAt = event.optString("createdAt").take(40),
                        state = event.optJSONObject("metadata")?.optString("state")?.takeIf { it.isNotBlank() && it != "null" }
                    )
                }
            }
            val publishedJson = json.optJSONArray("publishedResults") ?: JSONArray()
            val publishedResults = (0 until minOf(publishedJson.length(), 100)).mapNotNull { i ->
                publishedJson.optJSONObject(i)?.let { row ->
                    val id = row.optInt("id"); val title = row.optString("title").trim()
                    val max = row.optDouble("maxMarks", -1.0); val marks = row.optDouble("marks", -1.0)
                    if (id <= 0 || title.isBlank() || max <= 0 || marks < 0) null
                    else SupportPublishedResult(id, title.take(200), marks, max, row.optString("updatedAt").take(40))
                }
            }
            val outcome = ticket.optJSONObject("outcome")?.let { row ->
                val before = row.optDouble("baseline", Double.NaN)
                val after = row.optDouble("followup", Double.NaN)
                val change = row.optDouble("improvementPp", Double.NaN)
                if (before.isFinite() && after.isFinite() && change.isFinite())
                    SupportOutcome(before, after, change, row.optString("comparisonReason").takeIf { it.isNotBlank() && it != "null" })
                else null
            }
            SupportTicket(
                summary = canonical,
                question = ticket.optString("question").take(4000),
                attempted = ticket.optString("attempted").take(2000),
                history = history, educators = educators, publishedResults = publishedResults, outcome = outcome
            )
        }

    suspend fun assignSupportTicket(ticket: SupportTicket, staffId: String): SupportTicketSummary =
        sendSupportAction(ticket.summary, JSONObject().put("kind", "assign").put("staffId", staffId))

    suspend fun scheduleSupportPractice(ticket: SupportTicket, body: String, reviewAt: String): SupportTicketSummary {
        require(body.trim().length in 5..4000 && reviewAt.length in 20..40)
        return sendSupportAction(ticket.summary, JSONObject().put("kind", "practice")
            .put("body", body.trim()).put("reviewAt", reviewAt))
    }

    suspend fun submitLearnerSupportFeedback(ticket: SupportTicket, feedback: String): SupportTicketSummary {
        require(feedback in setOf("helpful", "needs_more_help"))
        return sendSupportAction(ticket.summary, JSONObject().put("kind", "feedback").put("feedback", feedback))
    }

    suspend fun transitionSupportTicket(ticket: SupportTicket, status: String, reason: String): SupportTicketSummary {
        require(status in setOf("triaged", "assigned", "in_progress", "awaiting_learner", "follow_up_required", "resolved", "closed"))
        require(reason.trim().length in 3..1000)
        return sendSupportAction(ticket.summary, JSONObject().put("kind", "transition")
            .put("status", status).put("reason", reason.trim()))
    }

    suspend fun recordSupportOutcome(ticket: SupportTicket, baselineId: Int, followupId: Int, reason: String): SupportTicketSummary {
        require(baselineId > 0 && followupId > 0 && baselineId != followupId && reason.trim().length in 20..2000)
        return sendSupportAction(ticket.summary, JSONObject().put("kind", "outcome")
            .put("baselineGradeId", baselineId).put("followupGradeId", followupId).put("comparisonReason", reason.trim()))
    }

    suspend fun saveLearningDna(ticket: SupportTicket, state: String, body: String): SupportTicketSummary {
        require(state in setOf("demonstrated", "needs_practice", "not_attempted") && body.trim().length in 20..2000)
        return sendSupportAction(ticket.summary, JSONObject().put("kind", "learning_dna")
            .put("state", state).put("body", body.trim()))
    }

    private suspend fun sendSupportAction(summary: SupportTicketSummary, action: JSONObject): SupportTicketSummary =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val response = request("/api/organizations/${summary.organizationId}/support/${summary.id}/actions",
                JSONObject().put("version", summary.version).put("action", action), auth = true)
            require(response.optInt("id") == summary.id && response.optInt("version") == summary.version + 1)
            summary.copy(status = response.optString("status", summary.status).take(32),
                version = response.optInt("version"), updatedAt = response.optString("updatedAt", summary.updatedAt),
                assignedTo = response.optString("assignedTo").takeIf { it.isNotBlank() && it != "null" },
                reviewAt = response.optString("reviewAt").takeIf { it.isNotBlank() && it != "null" })
        }

    suspend fun requestSupportGuidance(summary: SupportTicketSummary): SupportGuidanceDraft =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val json = request(
                "/api/organizations/${summary.organizationId}/support/${summary.id}/guidance-draft",
                JSONObject(), auth = true
            )
            fun strings(key: String): List<String> {
                val values = json.optJSONArray(key) ?: JSONArray()
                return (0 until values.length()).mapNotNull { i ->
                    values.optString(i).takeIf { it.isNotBlank() }?.take(300)
                }.take(4)
            }
            SupportGuidanceDraft(
                explanation = json.optString("explanation").take(2000),
                questions = strings("questions"),
                practice = strings("practice"),
                source = json.optString("source", "non_ai_template").take(32)
            )
        }

    suspend fun replyToSupportTicket(summary: SupportTicketSummary, body: String): SupportTicketSummary =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(body.trim().length in 2..4000)
            val json = request(
                "/api/organizations/${summary.organizationId}/support/${summary.id}/actions",
                JSONObject().put("version", summary.version).put(
                    "action", JSONObject().put("kind", "reply").put("body", body.trim())
                ), auth = true
            )
            require(json.optInt("id") == summary.id)
            summary.copy(
                status = json.optString("status", summary.status).take(32),
                version = json.optInt("version", summary.version + 1).coerceAtLeast(1),
                updatedAt = json.optString("updatedAt", summary.updatedAt)
            )
        }

    suspend fun triageSupportTicket(summary: SupportTicketSummary, reason: String): SupportTicketSummary =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(reason.trim().length in 3..1000)
            val json = request(
                "/api/organizations/${summary.organizationId}/support/${summary.id}/actions",
                JSONObject().put("version", summary.version).put(
                    "action", JSONObject().put("kind", "transition")
                        .put("status", "triaged").put("reason", reason.trim())
                ), auth = true
            )
            require(json.optInt("id") == summary.id)
            summary.copy(
                status = json.optString("status", "triaged").take(32),
                version = json.optInt("version", summary.version + 1).coerceAtLeast(1),
                updatedAt = json.optString("updatedAt", summary.updatedAt)
            )
        }

    suspend fun fetchQuiz(id: Int): PracticeQuiz =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(id > 0)
            val obj = request("/api/quizzes/$id", auth = true)
            val questions = obj.getJSONArray("questions")
            val result = (0 until questions.length()).map { i ->
                val q = questions.getJSONObject(i)
                val a = q.getJSONArray("options")
                QuizQuestion(q.getString("prompt"),
                    (0 until a.length()).map { index -> a.getString(index) })
            }
            require(obj.getInt("id") == id && result.isNotEmpty() &&
                result.all { it.options.isNotEmpty() }) { "Invalid assessment content" }
            PracticeQuiz(id, obj.getString("title"), result)
        }

    suspend fun submitQuiz(id: Int, answers: List<Int>, requestKey: String): QuizAttempt =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(id > 0 && answers.isNotEmpty() && answers.all { it >= 0 })
            val json = request("/api/quizzes/$id/attempts",
                JSONObject().put("answers", JSONArray(answers)), auth = true, requestKey = requestKey)
            val rows = json.getJSONArray("feedback")
            val feedback = (0 until rows.length()).map { i ->
                val row = rows.getJSONObject(i)
                QuizFeedback(row.getInt("questionIndex"),
                    row.getBoolean("isCorrect"), row.getString("explanation"))
            }
            require(json.getInt("quizId") == id) { "Mismatched assessment result" }
            QuizAttempt(json.getInt("id"), id, json.getInt("correctCount"),
                json.getInt("totalQuestions"), json.getDouble("percentage"), feedback)
        }

    suspend fun lookupQuiz(id: Int, requestKey: String): QuizAttempt =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(id > 0 && requestKey.matches(Regex("[A-Za-z0-9_-]{16,64}")))
            val json = request("/api/quizzes/$id/attempts/by-key/$requestKey", auth = true)
            val rows = json.getJSONArray("feedback")
            val feedback = (0 until rows.length()).map { i ->
                val row = rows.getJSONObject(i)
                QuizFeedback(row.getInt("questionIndex"),
                    row.getBoolean("isCorrect"), row.getString("explanation"))
            }
            require(json.getInt("quizId") == id) { "Mismatched result" }
            QuizAttempt(json.getInt("id"), id, json.getInt("correctCount"),
                json.getInt("totalQuestions"), json.getDouble("percentage"), feedback)
        }

    suspend fun fetchMaterialPage(id: Int, offset: Int): MaterialPage =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(id > 0 && offset >= 0)
            val obj = request("/api/materials/$id/preview?offset=$offset", auth = true)
            val next = if (obj.isNull("nextOffset")) null else obj.getInt("nextOffset")
            require(obj.getInt("id") == id && obj.getInt("offset") == offset &&
                (next == null || next > offset)) { "Invalid reading position" }
            MaterialPage(id, obj.getString("title"), obj.getString("text"), offset, next)
        }

    suspend fun respondToGuardianInvite(invitationId: Int, accept: Boolean): Unit =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(invitationId > 0)
            request("/api/guardian-relationships/$invitationId/decision",
                JSONObject().put("decision", if (accept) "accepted" else "declined"), auth = true)
        }

    suspend fun signOut(): Unit = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        try {
            val token = secrets.get("token")
            if (token != null) {
                val c = URL("$origin/api/native/logout").openConnection() as HttpURLConnection
                c.requestMethod = "POST"
                c.connectTimeout = 5000
                c.readTimeout = 5000
                c.setRequestProperty("Authorization", "Bearer $token")
                c.doOutput = true
                try { c.outputStream.use { }; c.responseCode } finally { c.disconnect() }
            }
        } catch (_: Exception) {
            // Local sign-out always happens. Remote revocation may fail offline;
            // server-issued native tokens have a one-hour maximum lifetime.
        } finally { secrets.clearSession(); secrets.clearChallenge() }
    }
}
