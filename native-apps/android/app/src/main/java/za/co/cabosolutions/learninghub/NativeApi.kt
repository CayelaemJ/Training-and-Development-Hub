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
internal data class WrittenExamQuestion(val prompt: String, val type: String, val maxMarks: Int)
internal data class WrittenExam(val id: Int, val title: String, val difficulty: String, val questions: List<WrittenExamQuestion>)
internal data class WrittenExamAssignment(val id: Int, val examId: Int, val title: String,
    val organizationId: Int, val organization: String, val dueAt: String?)
internal data class WrittenExamMark(val questionIndex: Int, val awardedMarks: Double, val maxMarks: Double,
    val feedback: String, val needsReview: Boolean)
internal data class WrittenExamResult(val id: Int, val percentage: Double, val awardedMarks: Double,
    val maxMarks: Double, val reviewRequired: Int, val feedback: List<WrittenExamMark>)
internal data class ManagedExamGroup(val id: Int, val name: String)
internal data class ManagedExamAssignment(val id: Int, val groupId: Int, val examId: Int, val dueAt: String?)
internal data class ManagedExamSubmission(
    val id: Int, val assignmentId: Int, val userId: String, val attemptId: Int,
    val percentage: Double, val awardedMarks: Double, val maxMarks: Double,
    val answers: List<String>, val feedback: List<WrittenExamMark>
)
internal data class ExamManagementWorkspace(
    val organizationId: Int, val organizationName: String, val groups: List<ManagedExamGroup>,
    val assignments: List<ManagedExamAssignment>, val submissions: List<ManagedExamSubmission>,
    val notice: String? = null
)
internal data class ExamManagementResources(val materials: List<MaterialSummary>, val exams: List<WrittenExam>)

internal data class SchoolNotice(val id: Int, val subject: String, val message: String, val audience: String, val createdAt: String)
internal data class SchoolAttendanceRecord(val day: String, val status: String)
internal data class SchoolTimetableSlot(val id: Int, val day: Int, val startsAt: String, val endsAt: String,
    val grade: String, val group: String, val subject: String, val room: String, val teacherId: String, val status: String)
internal data class SchoolAttendanceSummary(val year: Int, val records: Int, val counts: Map<String, Int>)
internal data class NotificationPreferenceChoice(val kind: String, val enabled: Boolean, val canEnable: Boolean)
internal data class NotificationPreferenceSchool(val id: Int, val name: String, val choices: List<NotificationPreferenceChoice>)
internal data class NotificationPreferences(val enabled: Boolean, val optInAvailable: Boolean, val schools: List<NotificationPreferenceSchool>)

internal data class AssessmentQuestion(
    val id: Int, val organizationId: Int, val grade: String, val subject: String, val curriculum: String,
    val stem: String, val answerGuide: String, val rubric: String, val sourceAttribution: String,
    val license: String, val status: String, val createdBy: String, val reviewedBy: String?
)
internal data class AssessmentPaper(
    val id: Int, val title: String, val grade: String, val subject: String, val curriculum: String,
    val academicYear: Int, val status: String, val createdBy: String, val approvedBy: String?, val questionCount: Int
)
internal data class AssessmentWorkspace(
    val organizationId: Int, val organizationName: String, val membershipRole: String,
    val questions: List<AssessmentQuestion>, val papers: List<AssessmentPaper>, val notice: String? = null
)

internal data class SchoolOperationsWorkspace(
    val organizationId: Int, val organizationName: String, val membershipRole: String,
    val notices: List<SchoolNotice>, val attendance: List<SchoolAttendanceRecord>,
    val timetable: List<SchoolTimetableSlot>, val attendanceSummary: SchoolAttendanceSummary? = null,
    val notice: String? = null
) { val canManage: Boolean get() = membershipRole in setOf("owner", "admin") }

internal data class NativePortal(val role: String, val summary: List<String>, val areas: List<String>)
internal data class GuardianInvite(
    val id: Int, val status: String, val learnerName: String?, val verified: Boolean
)
internal data class GuardianReview(val id: Int, val learnerId: String, val guardianId: String, val status: String)
internal data class GuardianReviewWorkspace(val organizationId: Int, val reviews: List<GuardianReview>)
internal data class ReportIssuanceRecord(
    val id: Int, val learnerId: String, val academicYear: Int, val version: Int,
    val status: String, val submittedBy: String, val reviewedBy: String?,
    val contentHash: String, val issuedAt: String?
)
internal data class ReportIssuanceWorkspace(val organizationId: Int, val records: List<ReportIssuanceRecord>)
internal data class IssuedReportSnapshot(
    val grade: String, val average: Double?, val subjects: List<GuardianSubject>,
    val attendanceRate: Int?, val presentDays: Int, val recordedDays: Int
)
internal data class IssuedSchoolReport(
    val id: Int, val organizationId: Int, val academicYear: Int,
    val contentHash: String, val snapshot: IssuedReportSnapshot, val learnerName: String? = null
) { val key: String get() = "$organizationId:$id" }
internal data class ReportIntegrityCheck(
    val hashValid: Boolean?, val cryptographicallySigned: Boolean,
    val signatureValid: Boolean, val issuerIdentityAccredited: Boolean
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
    val guardianReviewWorkspaces: List<GuardianReviewWorkspace> = emptyList(),
    val reportIssuanceWorkspaces: List<ReportIssuanceWorkspace> = emptyList(),
    val issuedReports: List<IssuedSchoolReport> = emptyList(),
    val issuedReportIntegrity: Map<String, ReportIntegrityCheck> = emptyMap(),
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
    val writtenExams: List<WrittenExam> = emptyList(),
    val writtenAssignments: List<WrittenExamAssignment> = emptyList(),
    val examManagementWorkspaces: List<ExamManagementWorkspace> = emptyList(),
    val canManageExamAssignments: Boolean = false,
    val adminOrganizations: List<String> = emptyList(),
    val learnerReports: List<LearnerAcademicReport> = emptyList(),
    val learnerReportNotice: String = "",
    val schoolOperations: List<SchoolOperationsWorkspace> = emptyList(),
    val assessmentWorkspaces: List<AssessmentWorkspace> = emptyList(),
    val notificationPreferences: NotificationPreferences = NotificationPreferences(false, false, emptyList())
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
                        auth: Boolean = false, requestKey: String? = null, timeoutMs: Int = 9000): JSONObject {
        val url = URL(origin + route)
        val connection = url.openConnection() as HttpURLConnection
        connection.connectTimeout = timeoutMs.coerceIn(9000, 180000)
        connection.readTimeout = timeoutMs.coerceIn(9000, 180000)
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

    private fun parseIssuedReport(row: JSONObject, organizationId: Int, learnerName: String? = null): IssuedSchoolReport? {
        val id = row.optInt("id")
        val year = row.optInt("academicYear", row.optInt("year"))
        val hash = row.optString("contentHash")
        val snapshot = row.optJSONObject("snapshot") ?: return null
        val grade = snapshot.optString("grade")
        if (id <= 0 || organizationId <= 0 || year !in 2000..2200 || hash.length !in 32..256 || grade.isBlank()) return null
        val subjectsJson = snapshot.optJSONArray("subjects") ?: JSONArray()
        val subjects = (0 until minOf(subjectsJson.length(), 100)).mapNotNull { i ->
            subjectsJson.optJSONObject(i)?.let { subject ->
                val name = subject.optString("name")
                if (name.isBlank()) null else GuardianSubject(name.take(160), subject.optDouble("percentage"), subject.optInt("assessmentCount"))
            }
        }
        val attendance = snapshot.optJSONObject("attendance") ?: JSONObject()
        return IssuedSchoolReport(id, organizationId, year, hash.take(256), IssuedReportSnapshot(
            grade.take(32), if (snapshot.isNull("average")) null else snapshot.optDouble("average"),
            subjects, if (attendance.isNull("rate")) null else attendance.optInt("rate"),
            attendance.optInt("presentDays"), attendance.optInt("recordedDays")
        ), learnerName?.take(160))
    }

    private fun hasManagerOrganizationMembership(): Boolean = try {
        val rows = getArray("/api/organizations")
        (0 until minOf(rows.length(), 100)).any { i ->
            val row = rows.optJSONObject(i)
            row?.optString("role") in setOf("owner", "admin")
        }
    } catch (_: Exception) { false }

    private fun loadAssessmentWorkspaces(): List<AssessmentWorkspace> {
        val memberships = try { getArray("/api/organizations") } catch (error: Exception) {
            if (!hasSession()) throw error
            return emptyList()
        }
        return (0 until minOf(memberships.length(), 12)).mapNotNull { i ->
            val member = memberships.optJSONObject(i) ?: return@mapNotNull null
            val orgId = member.optInt("id")
            val name = member.optString("name").trim()
            val memberRole = member.optString("role")
            if (orgId <= 0 || name.isBlank() || memberRole !in setOf("owner", "admin", "teacher", "assessor")) return@mapNotNull null
            var partialFailure = false
            val questions = try {
                val rows = getArray("/api/organizations/" + orgId + "/question-bank")
                (0 until minOf(rows.length(), 200)).mapNotNull { q ->
                    rows.optJSONObject(q)?.let { row ->
                        val questionId = row.optInt("id")
                        if (questionId <= 0) null else AssessmentQuestion(
                            questionId, row.optInt("organizationId"), row.optString("grade").take(24),
                            row.optString("subject").take(120), row.optString("curriculum").take(32),
                            row.optString("stem").take(8000), row.optString("answerGuide").take(8000),
                            row.optString("rubric").take(6000), row.optString("sourceAttribution").take(2000),
                            row.optString("license").take(60), row.optString("status").take(24),
                            row.optString("createdBy").take(160),
                            if (row.isNull("reviewedBy")) null else row.optString("reviewedBy").take(160)
                        )
                    }
                }
            } catch (error: Exception) { if (!hasSession()) throw error else { partialFailure = true; emptyList() } }
            val papers = try {
                val rows = getArray("/api/organizations/" + orgId + "/assessment-papers")
                (0 until minOf(rows.length(), 100)).mapNotNull { p ->
                    rows.optJSONObject(p)?.let { row ->
                        val paperId = row.optInt("id")
                        if (paperId <= 0) null else AssessmentPaper(
                            paperId, row.optString("title").take(180), row.optString("grade").take(24),
                            row.optString("subject").take(120), row.optString("curriculum").take(32),
                            row.optInt("academicYear"), row.optString("status").take(24),
                            row.optString("createdBy").take(160),
                            if (row.isNull("approvedBy")) null else row.optString("approvedBy").take(160),
                            row.optInt("questionCount").coerceIn(0, 50)
                        )
                    }
                }
            } catch (error: Exception) { if (!hasSession()) throw error else { partialFailure = true; emptyList() } }
            AssessmentWorkspace(orgId, name.take(200), memberRole, questions, papers,
                if (partialFailure) "Some assessment data could not load. Refresh and check school access." else null)
        }
    }

    private fun loadSchoolOperations(): List<SchoolOperationsWorkspace> {
        val memberships = try { getArray("/api/organizations") } catch (error: Exception) {
            if (!hasSession()) throw error
            return emptyList()
        }
        val year = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)
        return (0 until minOf(memberships.length(), 12)).mapNotNull { i ->
            val member = memberships.optJSONObject(i) ?: return@mapNotNull null
            val orgId = member.optInt("id")
            val name = member.optString("name").trim()
            val memberRole = member.optString("role")
            if (orgId <= 0 || name.isBlank() || memberRole.isBlank()) return@mapNotNull null
            var partialFailure = false
            val notices = try {
                val rows = getArray("/api/organizations/$orgId/notices")
                (0 until minOf(rows.length(), 100)).mapNotNull { n -> rows.optJSONObject(n)?.let { row ->
                    val id = row.optInt("id"); val subject = row.optString("subject").trim()
                    if (id <= 0 || subject.isBlank()) null else SchoolNotice(id, subject.take(180),
                        row.optString("message").take(5000), row.optString("audience").take(16), row.optString("createdAt").take(40))
                } }
            } catch (error: Exception) { if (!hasSession()) throw error else { partialFailure = true; emptyList() } }
            val attendance = if (memberRole == "learner") try {
                val rows = request("/api/organizations/$orgId/attendance/me", auth = true).optJSONArray("attendance") ?: JSONArray()
                (0 until minOf(rows.length(), 180)).mapNotNull { a -> rows.optJSONObject(a)?.let { row ->
                    val day = row.optString("day"); val status = row.optString("status")
                    if (day.length != 10 || status !in setOf("present", "absent", "late", "excused")) null
                    else SchoolAttendanceRecord(day, status)
                } }
            } catch (error: Exception) { if (!hasSession()) throw error else { partialFailure = true; emptyList() } } else emptyList()
            val timetable = try {
                val rows = getArray("/api/organizations/$orgId/timetable?year=$year")
                (0 until minOf(rows.length(), 200)).mapNotNull { t -> rows.optJSONObject(t)?.let { row ->
                    val id = row.optInt("id"); val subject = row.optString("subject").trim()
                    if (id <= 0 || subject.isBlank()) null else SchoolTimetableSlot(id, row.optInt("day"),
                        row.optString("startsAt").take(5), row.optString("endsAt").take(5), row.optString("grade").take(32),
                        row.optString("group").take(40), subject.take(100), row.optString("room").take(80),
                        row.optString("teacherId").take(160), row.optString("status").take(16))
                } }
            } catch (error: Exception) { if (!hasSession()) throw error else { partialFailure = true; emptyList() } }
            val summary = if (memberRole in setOf("owner", "admin")) try {
                val row = request("/api/organizations/$orgId/attendance/summary?year=$year", auth = true)
                val counts = row.optJSONObject("counts")?.let { c -> c.keys().asSequence().associateWith { c.optInt(it).coerceAtLeast(0) } } ?: emptyMap()
                SchoolAttendanceSummary(row.optInt("year", year), row.optInt("records").coerceAtLeast(0), counts)
            } catch (error: Exception) { if (!hasSession()) throw error else { partialFailure = true; null } } else null
            SchoolOperationsWorkspace(orgId, name.take(200), memberRole.take(40), notices, attendance, timetable, summary,
                if (partialFailure) "Some school data could not load. Check your connection and refresh." else null)
        }
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
            val notificationPreferences = try {
                val payload = request("/api/notifications/preferences", auth = true)
                val rows = payload.optJSONArray("schools") ?: JSONArray()
                val schools = (0 until minOf(rows.length(), 100)).mapNotNull { i ->
                    val row = rows.optJSONObject(i) ?: return@mapNotNull null
                    val id = row.optInt("id"); val name = row.optString("name")
                    if (id <= 0 || name.isBlank()) return@mapNotNull null
                    val choicesJson = row.optJSONArray("choices") ?: JSONArray()
                    val choices = (0 until minOf(choicesJson.length(), 10)).mapNotNull { j ->
                        val choice = choicesJson.optJSONObject(j) ?: return@mapNotNull null
                        val kind = choice.optString("kind")
                        if (kind !in setOf("guardian_review_requested", "learner_support_updated")) null
                        else NotificationPreferenceChoice(kind, choice.optBoolean("enabled"), choice.optBoolean("canEnable"))
                    }
                    NotificationPreferenceSchool(id, name.take(200), choices)
                }
                NotificationPreferences(payload.optBoolean("enabled"), payload.optBoolean("optInAvailable"), schools)
            } catch (_: Exception) { NotificationPreferences(false, false, emptyList()) }
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
            val issuedReports = reports
                .distinctBy { "${it.learnerId}:${it.organizationId}" }
                .take(12)
                .flatMap { report ->
                try {
                    val rows = getArray("/api/guardian/issued-reports/${Uri.encode(report.learnerId)}?organizationId=${report.organizationId}")
                    (0 until minOf(rows.length(), 50)).mapNotNull { i ->
                        rows.optJSONObject(i)?.let { parseIssuedReport(it, report.organizationId, report.learnerName) }
                    }
                } catch (error: Exception) {
                    if (!hasSession()) throw error
                    emptyList()
                }
            }.distinctBy { it.key }.take(100)
            return@withContext NativeLearning(
                NativePortal(role, summary, cards), emptyList(), emptyList(),
                guardians = relationships, parentGuidance = response.optString("guidance"),
                parentReports = reports, parentReportNotice = notice, issuedReports = issuedReports,
                notificationPreferences = notificationPreferences
            )
        }

        if (role in listOf("teacher", "assessor", "headmaster", "deputy_headmaster", "department_head", "grade_head")) {
            val guardianReviews = orgIds.mapNotNull { orgId ->
                try {
                    val rows = getArray("/api/organizations/$orgId/guardian-reviews")
                    val reviews = (0 until minOf(rows.length(), 200)).mapNotNull { i ->
                        rows.optJSONObject(i)?.let { row ->
                            val id = row.optInt("id"); val learnerId = row.optString("learnerId")
                            val guardianId = row.optString("guardianId"); val status = row.optString("status")
                            if (id <= 0 || learnerId.isBlank() || guardianId.isBlank() || status.isBlank()) null
                            else GuardianReview(id, learnerId.take(200), guardianId.take(200), status.take(32))
                        }
                    }
                    GuardianReviewWorkspace(orgId, reviews)
                } catch (error: Exception) {
                    if (!hasSession()) throw error
                    null
                }
            }
            val reportIssuance = orgIds.mapNotNull { orgId ->
                try {
                    val rows = getArray("/api/organizations/$orgId/report-issuance")
                    val records = (0 until minOf(rows.length(), 100)).mapNotNull { i ->
                        rows.optJSONObject(i)?.let { row ->
                            val id = row.optInt("id"); val learnerId = row.optString("learnerId")
                            val hash = row.optString("contentHash"); val status = row.optString("status")
                            if (id <= 0 || learnerId.isBlank() || hash.isBlank() || status.isBlank()) null
                            else ReportIssuanceRecord(id, learnerId.take(200), row.optInt("academicYear"),
                                row.optInt("version"), status.take(32), row.optString("submittedBy"),
                                row.optString("reviewedBy").takeIf { it.isNotBlank() && it != "null" },
                                hash.take(256), row.optString("issuedAt").takeIf { it.isNotBlank() && it != "null" })
                        }
                    }
                    ReportIssuanceWorkspace(orgId, records)
                } catch (error: Exception) {
                    if (!hasSession()) throw error
                    null
                }
            }
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
                NativePortal(role, summary, cards), emptyList(), emptyList(), staff = workspace,
                guardianReviewWorkspaces = guardianReviews, reportIssuanceWorkspaces = reportIssuance,
                canManageExamAssignments = hasManagerOrganizationMembership(),
                schoolOperations = loadSchoolOperations(),
                assessmentWorkspaces = loadAssessmentWorkspaces()
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
        val writtenExams = if (role in setOf("learner", "owner", "admin")) try {
            getArray("/api/written-exams").let { arr ->
                (0 until arr.length()).mapNotNull { i ->
                    val row = arr.optJSONObject(i) ?: return@mapNotNull null
                    parseWrittenExam(row)
                }.take(30)
            }
        } catch (error: Exception) {
            if (!hasSession()) throw error
            emptyList()
        } else emptyList()
        val examManagementWorkspaces = emptyList<ExamManagementWorkspace>()
        val writtenAssignments = if (role != "learner") emptyList() else try {
            getArray("/api/my-assignments").let { arr ->
                (0 until arr.length()).mapNotNull { i ->
                    val row = arr.optJSONObject(i) ?: return@mapNotNull null
                    val id = row.optInt("id")
                    val examId = row.optInt("examId")
                    val organizationId = row.optInt("organizationId")
                    val title = row.optString("title")
                    val organization = row.optString("organization")
                    if (id <= 0 || examId <= 0 || organizationId <= 0 ||
                        title.isBlank() || organization.isBlank()) null
                    else WrittenExamAssignment(id, examId, title, organizationId, organization,
                        if (row.isNull("dueAt")) null else row.optString("dueAt").take(40))
                }
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
        val issuedReports = if (role == "learner") {
            val rows = mutableListOf<IssuedSchoolReport>()
            orgIds.take(5).forEach { orgId ->
                try {
                    val reports = getArray("/api/organizations/$orgId/report-issuance/me")
                    (0 until minOf(reports.length(), 100 - rows.size)).forEach { i ->
                        reports.optJSONObject(i)?.let { report ->
                            parseIssuedReport(report, orgId)?.let(rows::add)
                        }
                    }
                } catch (error: Exception) {
                    if (!hasSession()) throw error
                }
            }
            rows
        } else emptyList()
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
            learnerSupportTickets = learnerSupportTickets, materialEntries = materialEntries, supportCourses = supportCourses, quizEntries = quizEntries, writtenExams = writtenExams, writtenAssignments = writtenAssignments, examManagementWorkspaces = examManagementWorkspaces,
            journeyIdentity = journeyIdentity, journeyEntries = journeyEntries, journeyMilestones = journeyMilestones,
            learnerReports = learnerReports, learnerReportNotice = learnerReportNotice, issuedReports = issuedReports,
            schoolOperations = loadSchoolOperations(),
            canManageExamAssignments = hasManagerOrganizationMembership())
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

    suspend fun generateWrittenExam(materialId: Int, questionCount: Int, difficulty: String): WrittenExam =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(materialId > 0 && questionCount in 1..10 && difficulty in setOf("beginner", "intermediate", "advanced"))
            val response = request("/api/materials/$materialId/written-exams",
                JSONObject().put("questionCount", questionCount).put("difficulty", difficulty),
                auth = true, timeoutMs = 85000)
            parseWrittenExam(response)
        }

    suspend fun fetchAssignedWrittenExam(assignmentId: Int): WrittenExam =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(assignmentId > 0)
            parseWrittenExam(request("/api/assignments/$assignmentId/exam", auth = true))
        }

    suspend fun fetchWrittenExam(id: Int): WrittenExam =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(id > 0)
            parseWrittenExam(request("/api/written-exams/$id", auth = true))
        }

    suspend fun submitWrittenExam(examId: Int, answers: List<String>, assignmentId: Int? = null): WrittenExamResult =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(examId > 0 && answers.isNotEmpty() && answers.size <= 15 && answers.all { it.length <= 15000 })
            require(assignmentId == null || assignmentId > 0)
            val payload = JSONObject().put("answers", JSONArray(answers))
            if (assignmentId != null) payload.put("assignmentId", assignmentId)
            val response = request("/api/written-exams/$examId/attempts",
                payload, auth = true, timeoutMs = 85000)
            val rows = response.getJSONArray("feedback")
            val marks = (0 until rows.length()).map { i ->
                val row = rows.getJSONObject(i)
                WrittenExamMark(row.getInt("questionIndex"), row.getDouble("awardedMarks"),
                    row.getDouble("maxMarks"), row.getString("feedback"), row.getBoolean("needsReview"))
            }
            WrittenExamResult(response.getInt("id"), response.getDouble("percentage"),
                response.getDouble("awardedMarks"), response.getDouble("maxMarks"),
                response.optInt("reviewRequired"), marks)
        }

    private fun parseWrittenExam(row: JSONObject): WrittenExam {
        val id = row.getInt("id")
        val questionRows = row.getJSONArray("questions")
        val questions = (0 until questionRows.length()).map { i ->
            val q = questionRows.getJSONObject(i)
            WrittenExamQuestion(q.getString("prompt"), q.getString("type"), q.getInt("maxMarks"))
        }
        require(id > 0 && questions.isNotEmpty() && questions.size <= 15 &&
            questions.all { it.prompt.isNotBlank() && it.maxMarks in 1..25 }) { "Invalid written exam" }
        return WrittenExam(id, row.getString("title"), row.optString("difficulty", "intermediate"), questions)
    }

    suspend fun fetchExamManagementResources(): ExamManagementResources =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val materials = try {
                getArray("/api/materials").let { rows ->
                    (0 until minOf(rows.length(), 30)).mapNotNull { i ->
                        rows.optJSONObject(i)?.let { row ->
                            val id = row.optInt("id"); val title = row.optString("title")
                            if (id > 0 && title.isNotBlank()) MaterialSummary(id, title.take(200)) else null
                        }
                    }
                }
            } catch (_: Exception) { emptyList() }
            val exams = try {
                getArray("/api/written-exams").let { rows ->
                    (0 until minOf(rows.length(), 30)).mapNotNull { i ->
                        try { rows.optJSONObject(i)?.let(::parseWrittenExam) } catch (_: Exception) { null }
                    }
                }
            } catch (_: Exception) { emptyList() }
            ExamManagementResources(materials, exams)
        }

    suspend fun fetchExamManagementWorkspaces(): List<ExamManagementWorkspace> =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { loadExamManagementWorkspaces() }

    private suspend fun loadExamManagementWorkspaces(): List<ExamManagementWorkspace> {
        val memberships = try { getArray("/api/organizations") } catch (_: Exception) { return emptyList() }
        return (0 until minOf(memberships.length(), 5)).mapNotNull { index ->
            val membership = memberships.optJSONObject(index) ?: return@mapNotNull null
            val orgId = membership.optInt("id")
            val role = membership.optString("role")
            val name = membership.optString("name")
            if (orgId <= 0 || role !in setOf("owner", "admin") || name.isBlank()) return@mapNotNull null
            try {
                val groupsJson = getArray("/api/organizations/$orgId/groups")
                val groups = (0 until minOf(groupsJson.length(), 200)).mapNotNull { i ->
                    groupsJson.optJSONObject(i)?.let { row ->
                        val id = row.optInt("id"); val groupName = row.optString("name")
                        if (id > 0 && groupName.isNotBlank()) ManagedExamGroup(id, groupName.take(200)) else null
                    }
                }
                val assignmentsJson = getArray("/api/organizations/$orgId/assignments")
                val assignments = (0 until minOf(assignmentsJson.length(), 200)).mapNotNull { i ->
                    assignmentsJson.optJSONObject(i)?.let { row ->
                        val id = row.optInt("id"); val groupId = row.optInt("groupId"); val examId = row.optInt("examId")
                        if (id > 0 && groupId > 0 && examId > 0) ManagedExamAssignment(
                            id, groupId, examId, if (row.isNull("dueAt")) null else row.optString("dueAt").take(40)
                        ) else null
                    }
                }
                val submissionsJson = getArray("/api/organizations/$orgId/submissions")
                val submissions = (0 until minOf(submissionsJson.length(), 500)).mapNotNull { i ->
                    submissionsJson.optJSONObject(i)?.let { row ->
                        val id = row.optInt("id"); val assignmentId = row.optInt("assignmentId")
                        val userId = row.optString("userId"); val attemptId = row.optInt("attemptId")
                        if (id <= 0 || assignmentId <= 0 || userId.isBlank() || attemptId <= 0) null
                        else {
                            val answersJson = row.optJSONArray("answers") ?: JSONArray()
                            val answers = (0 until minOf(answersJson.length(), 15)).map { answersJson.optString(it).take(15000) }
                            val feedbackJson = row.optJSONArray("feedback") ?: JSONArray()
                            val feedback = (0 until minOf(feedbackJson.length(), 15)).mapNotNull { j ->
                                feedbackJson.optJSONObject(j)?.let { mark ->
                                    val q = mark.optInt("questionIndex")
                                    val awarded = mark.optDouble("awardedMarks", -1.0)
                                    val max = mark.optDouble("maxMarks", -1.0)
                                    if (q < 0 || awarded < 0 || max <= 0) null else WrittenExamMark(
                                        q, awarded, max, mark.optString("feedback").take(2000),
                                        mark.optBoolean("needsReview")
                                    )
                                }
                            }
                            ManagedExamSubmission(id, assignmentId, userId.take(160), attemptId,
                                row.optDouble("percentage"), row.optDouble("awardedMarks"),
                                row.optDouble("maxMarks"), answers, feedback)
                        }
                    }
                }
                ExamManagementWorkspace(orgId, name.take(200), groups, assignments, submissions)
            } catch (_: Exception) {
                ExamManagementWorkspace(orgId, name.take(200), emptyList(), emptyList(), emptyList(),
                    "Assignment workspace could not be loaded. Check your connection and retry.")
            }
        }
    }

    suspend fun createExamAssignment(organizationId: Int, groupId: Int, examId: Int, dueAt: String?) =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(organizationId > 0 && groupId > 0 && examId > 0)
            val payload = JSONObject().put("groupId", groupId).put("examId", examId)
            if (!dueAt.isNullOrBlank()) {
                require(dueAt.length <= 40 && dueAt.matches(Regex("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2})?Z")))
                payload.put("dueAt", if (dueAt.length == 17) dueAt.replace("Z", ":00Z") else dueAt)
            }
            request("/api/organizations/$organizationId/assignments", payload, auth = true)
        }

    suspend fun overrideExamSubmission(organizationId: Int, submissionId: Int, questionIndex: Int, awardedMarks: Double, reason: String) =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(organizationId > 0 && submissionId > 0 && questionIndex in 0..14 &&
                awardedMarks >= 0 && awardedMarks <= 100 && reason.trim().length in 5..2000)
            request("/api/organizations/$organizationId/submissions/$submissionId/overrides",
                JSONObject().put("questionIndex", questionIndex).put("awardedMarks", awardedMarks)
                    .put("reason", reason.trim()), auth = true)
        }

    suspend fun setNotificationPreference(organizationId: Int, kind: String, enabled: Boolean, acknowledged: Boolean) =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(organizationId > 0 && kind in setOf("guardian_review_requested", "learner_support_updated"))
            request("/api/notifications/preferences/$organizationId/$kind",
                JSONObject().put("enabled", enabled).put("acknowledged", acknowledged),
                method = "PATCH", auth = true)
        }

    suspend fun respondToGuardianInvite(invitationId: Int, accept: Boolean): Unit =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(invitationId > 0)
            request("/api/guardian-relationships/$invitationId/decision",
                JSONObject().put("decision", if (accept) "accepted" else "declined"), auth = true)
        }

    suspend fun reviewGuardianRelationship(organizationId: Int, relationshipId: Int, decision: String): Unit =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(organizationId > 0 && relationshipId > 0 && decision in setOf("verified", "revoked"))
            request("/api/organizations/$organizationId/guardian-reviews/$relationshipId",
                JSONObject().put("decision", decision).put("evidenceReviewed", true), auth = true)
        }

    suspend fun submitSchoolReport(organizationId: Int, learnerId: String, academicYear: Int): Unit =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val learner = learnerId.trim()
            require(organizationId > 0 && learner.isNotEmpty() && learner.length <= 200 && academicYear in 2000..2200)
            request("/api/organizations/$organizationId/report-issuance",
                JSONObject().put("learnerId", learner).put("academicYear", academicYear), auth = true)
        }

    suspend fun decideSchoolReport(organizationId: Int, reportId: Int, action: String, reason: String): Unit =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val cleanReason = reason.trim()
            require(organizationId > 0 && reportId > 0 && action in setOf("approve", "reject", "issue", "revoke") && cleanReason.length <= 1000)
            require(action !in setOf("reject", "revoke") || cleanReason.isNotEmpty())
            request("/api/organizations/$organizationId/report-issuance/$reportId/decision",
                JSONObject().put("action", action).put("reason", cleanReason), auth = true)
        }

    suspend fun verifyIssuedReport(report: IssuedSchoolReport): ReportIntegrityCheck =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(report.id > 0 && report.organizationId > 0)
            val result = request("/api/organizations/${report.organizationId}/report-issuance/${report.id}/integrity", auth = true)
            ReportIntegrityCheck(
                if (result.isNull("hashValid")) null else result.optBoolean("hashValid"),
                result.optBoolean("cryptographicallySigned"), result.optBoolean("signatureValid"),
                result.optBoolean("issuerIdentityAccredited")
            )
        }

    suspend fun publishSchoolNotice(organizationId: Int, subject: String, message: String, audience: String) =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(organizationId > 0 && subject.trim().length in 3..180 && message.trim().length in 10..5000 && audience in setOf("all", "learners", "staff"))
            request("/api/organizations/$organizationId/notices", JSONObject().put("subject", subject.trim())
                .put("message", message.trim()).put("audience", audience), auth = true)
        }

    suspend fun recordSchoolAttendance(organizationId: Int, learnerId: String, day: String, attendanceStatus: String, note: String) =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(organizationId > 0 && learnerId.trim().length in 1..160 && day.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) &&
                attendanceStatus in setOf("present", "absent", "late", "excused") && note.length <= 1000)
            request("/api/organizations/$organizationId/attendance", JSONObject().put("learnerId", learnerId.trim())
                .put("day", day).put("status", attendanceStatus).put("note", note.take(1000)), auth = true)
        }

    suspend fun substituteSchoolTeacher(organizationId: Int, slotId: Int, replacementTeacherId: String, reason: String) =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(organizationId > 0 && slotId > 0 && replacementTeacherId.trim().length in 1..160 && reason.trim().length in 5..1000)
            request("/api/organizations/$organizationId/timetable/$slotId/substitution", JSONObject()
                .put("replacementTeacherId", replacementTeacherId.trim()).put("reason", reason.trim()), auth = true)
        }

    suspend fun createAssessmentQuestion(organizationId: Int, grade: String, subject: String, curriculum: String,
                                         stem: String, answerGuide: String, rubric: String, sourceAttribution: String,
                                         license: String) = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        require(organizationId > 0 && grade.trim().length in 1..24 && subject.trim().length in 2..120 &&
            curriculum.trim().length in 2..32 && stem.trim().length in 10..8000 && answerGuide.trim().length in 3..8000 &&
            rubric.length <= 6000 && sourceAttribution.trim().length in 5..2000 &&
            license in setOf("original", "CC-BY", "CC-BY-SA", "public-domain", "institution-licensed"))
        request("/api/organizations/" + organizationId + "/question-bank", JSONObject()
            .put("grade", grade.trim()).put("subject", subject.trim()).put("curriculum", curriculum.trim())
            .put("stem", stem.trim()).put("answerGuide", answerGuide.trim()).put("rubric", rubric.take(6000))
            .put("sourceAttribution", sourceAttribution.trim()).put("license", license), auth = true)
    }

    suspend fun decideAssessmentQuestion(organizationId: Int, questionId: Int, action: String, note: String) =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(organizationId > 0 && questionId > 0 && action in setOf("submit", "approve", "reject", "publish", "archive") && note.length <= 1500)
            request("/api/organizations/" + organizationId + "/question-bank/" + questionId + "/decision",
                JSONObject().put("action", action).put("note", note.trim()), auth = true)
        }

    suspend fun createAssessmentPaper(organizationId: Int, academicYear: Int, grade: String, subject: String,
                                     curriculum: String, title: String, questionIds: List<Int>) =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(organizationId > 0 && academicYear in 2000..2200 && grade.trim().length in 1..24 &&
                subject.trim().length in 2..120 && curriculum.trim().length in 2..32 && title.trim().length in 5..180 &&
                questionIds.isNotEmpty() && questionIds.size <= 50 && questionIds.distinct().size == questionIds.size)
            val ids = JSONArray().also { array -> questionIds.forEach(array::put) }
            request("/api/organizations/" + organizationId + "/assessment-papers", JSONObject()
                .put("academicYear", academicYear).put("grade", grade.trim()).put("subject", subject.trim())
                .put("curriculum", curriculum.trim()).put("title", title.trim()).put("questionIds", ids), auth = true)
        }

    suspend fun decideAssessmentPaper(organizationId: Int, paperId: Int, action: String, note: String) =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            require(organizationId > 0 && paperId > 0 && action in setOf("submit", "approve", "reject", "publish") && note.length <= 1000)
            request("/api/organizations/" + organizationId + "/assessment-papers/" + paperId + "/decision",
                JSONObject().put("action", action).put("note", note.trim()), auth = true)
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
