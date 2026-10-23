package za.co.cabosolutions.learninghub

import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.security.SecureRandom
import android.util.Base64

internal data class MaterialSummary(val id: Int, val title: String)
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
internal data class StaffWorkspace(
    val organizationId: Int, val courses: List<String>, val supportSummary: List<String>,
    val tickets: List<String>, val notice: String?
)
internal data class NativeLearning(
    val portal: NativePortal,
    val materials: List<String>,
    val quizzes: List<String>,
    val guardians: List<GuardianInvite> = emptyList(),
    val parentGuidance: String = "",
    val staff: List<StaffWorkspace> = emptyList(),
    val journey: List<String> = emptyList(),
    val learnerHelp: List<String> = emptyList(),
    val materialEntries: List<MaterialSummary> = emptyList(),
    val quizEntries: List<QuizSummary> = emptyList(),
    val adminOrganizations: List<String> = emptyList()
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
    private fun request(route: String, body: JSONObject? = null, auth: Boolean = false, requestKey: String? = null): JSONObject {
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
        if (body != null) {
            connection.requestMethod = "POST"
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
            return JSONObject(text)
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
            return@withContext NativeLearning(
                NativePortal(role, summary, cards), emptyList(), emptyList(),
                guardians = relationships,
                parentGuidance = response.optString("guidance")
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
                    val ticketNames = try {
                        val response = request("/api/organizations/$orgId/support", auth = true)
                        val tickets = response.optJSONArray("items") ?: JSONArray()
                        (0 until minOf(tickets.length(), 20)).mapNotNull { index ->
                            tickets.optJSONObject(index)?.let { row ->
                                val topic = row.optString("concept").take(80)
                                val state = row.optString("status").take(32)
                                if (topic.isBlank()) null else "$topic · $state"
                            }
                        }
                    } catch (error: Exception) {
                        if (!hasSession()) throw error
                        emptyList()
                    }
                    StaffWorkspace(orgId, courseNames, stats, ticketNames, null)
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
        val journey = try {
            val obj = request("/api/learner-journey/me", auth = true)
            val stages = obj.optJSONArray("journeys") ?: JSONArray()
            val milestones = obj.optJSONArray("milestones") ?: JSONArray()
            listOf("Learning stages: ${stages.length()}", "Milestones: ${milestones.length()}")
        } catch (error: Exception) {
            if (!hasSession()) throw error
            emptyList()
        }
        val learnerHelp = orgIds.take(3).flatMap { orgId ->
            try {
                val response = request("/api/organizations/$orgId/support", auth = true)
                val tickets = response.optJSONArray("items") ?: JSONArray()
                (0 until minOf(tickets.length(), 15)).mapNotNull { i ->
                    tickets.optJSONObject(i)?.let { row ->
                        val concept = row.optString("concept").take(80)
                        if (concept.isBlank()) null else "$concept · ${row.optString("status").take(32)}"
                    }
                }
            } catch (error: Exception) {
                if (!hasSession()) throw error
                emptyList()
            }
        }.take(20)
        NativeLearning(NativePortal(role, summary, cards), materialEntries.map { it.title },
            quizEntries.map { it.title }, journey = journey, learnerHelp = learnerHelp,
            materialEntries = materialEntries, quizEntries = quizEntries)
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
