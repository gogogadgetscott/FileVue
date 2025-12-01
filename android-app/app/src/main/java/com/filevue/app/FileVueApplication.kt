package com.filevue.app

import android.app.Application
import com.filevue.app.api.ApiClient
import com.filevue.app.util.SecureStorage

/**
 * FileVue Application class for global initialization
 */
class FileVueApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        
        // Initialize secure storage
        SecureStorage.init(this)
        
        // Restore saved server configuration
        SecureStorage.getServerUrl()?.let { url ->
            if (url.isNotEmpty()) {
                ApiClient.configure(url)
            }
        }
        
        // Restore saved auth token
        SecureStorage.getAuthToken()?.let { token ->
            if (token.isNotEmpty()) {
                ApiClient.setAuthToken(token)
            }
        }
    }
}
