package com.filevue.app.util

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Secure storage for sensitive data like auth tokens
 */
object SecureStorage {
    private const val PREFS_NAME = "filevue_secure_prefs"
    private const val KEY_AUTH_TOKEN = "auth_token"
    private const val KEY_SERVER_URL = "server_url"
    private const val KEY_USERNAME = "username"

    private var encryptedPrefs: SharedPreferences? = null

    fun init(context: Context) {
        if (encryptedPrefs == null) {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            encryptedPrefs = EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }
    }

    fun saveAuthToken(token: String) {
        encryptedPrefs?.edit()?.putString(KEY_AUTH_TOKEN, token)?.apply()
    }

    fun getAuthToken(): String? {
        return encryptedPrefs?.getString(KEY_AUTH_TOKEN, null)
    }

    fun clearAuthToken() {
        encryptedPrefs?.edit()?.remove(KEY_AUTH_TOKEN)?.apply()
    }

    fun saveServerUrl(url: String) {
        encryptedPrefs?.edit()?.putString(KEY_SERVER_URL, url)?.apply()
    }

    fun getServerUrl(): String? {
        return encryptedPrefs?.getString(KEY_SERVER_URL, null)
    }

    fun saveUsername(username: String) {
        encryptedPrefs?.edit()?.putString(KEY_USERNAME, username)?.apply()
    }

    fun getUsername(): String? {
        return encryptedPrefs?.getString(KEY_USERNAME, null)
    }

    fun clearAll() {
        encryptedPrefs?.edit()?.clear()?.apply()
    }
}
