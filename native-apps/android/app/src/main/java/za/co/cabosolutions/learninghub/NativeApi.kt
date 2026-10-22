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

internal data class NativePortal(val role: String, val summary: List<String>, val areas: List<String>)
internal data class NativeLearning(val portal: NativePortal, val materials: List<String>, val quizzes: List<String>)

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
    private fun request(route: String, body: JSONObject? = null, auth: Boolean = false): JSONObject {
        val url = URL(origin + route)
        val connection = url.openConnection() as HttpURLConnection
        connection.connectTimeout = 9000
        connection.readTimeout = 9000
        connection.instanceFollowRedirects = false
        connection.useCaches = false
        connection.setRequestProperty("Accept", "application/json")
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
        val summary = json.optJSONObject("summary")?.let { obj ->
            obj.keys().asSequence().map { key -> "$key: ${obj.optInt(key)}" }.toList()
        } ?: emptyList()
        val cards = json.optJSONArray("cards")?.let { arr ->
            (0 until arr.length()).mapNotNull { index -> arr.optJSONObject(index)?.optString("label") }
        } ?: emptyList()
        val materials = try {
            getArray("/api/materials").let { arr ->
                (0 until arr.length()).mapNotNull { i -> arr.optJSONObject(i)?.optString("title") }.take(8)
            }
        } catch (_: Exception) { emptyList() } // Dashboard still works if materials are unavailable.
        val quizzes = try {
            getArray("/api/quizzes").let { arr ->
                (0 until arr.length()).mapNotNull { i -> arr.optJSONObject(i)?.optString("title") }.take(8)
            }
        } catch (_: Exception) { emptyList() }
        NativeLearning(NativePortal(json.optString("role", "learner"), summary, cards), materials, quizzes)
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
