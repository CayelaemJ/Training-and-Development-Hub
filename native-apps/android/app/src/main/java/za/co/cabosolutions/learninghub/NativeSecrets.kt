package za.co.cabosolutions.learninghub

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// No passwords/cookies and no plaintext learner data are stored.
// PKCE verifier/state and short-lived native session stay encrypted under
// a non-exportable Android Keystore key; app backup is disabled.
internal class NativeSecrets(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("cabo_native_secrets_v1", Context.MODE_PRIVATE)
    private val alias = "cabo_native_auth_key_v1"

    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = store.getKey(alias, null) as? SecretKey
        if (existing != null) return existing
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build())
        return generator.generateKey()
    }

    @Synchronized
    fun put(name: String, value: String?) {
        if (value == null) {
            prefs.edit().remove(name).apply()
            return
        }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val result = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        prefs.edit().putString(name, Base64.encodeToString(result, Base64.NO_WRAP)).apply()
    }

    @Synchronized
    fun get(name: String): String? {
        val encoded = prefs.getString(name, null) ?: return null
        return try {
            val stored = Base64.decode(encoded, Base64.NO_WRAP)
            if (stored.size < 13) return null
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, stored.copyOfRange(0, 12)))
            cipher.doFinal(stored.copyOfRange(12, stored.size)).toString(Charsets.UTF_8)
        } catch (_: Exception) {
            put(name, null)
            null
        }
    }

    fun clearSession() { put("token", null) }
    fun clearChallenge() { put("verifier", null); put("state", null) }
}
