package com.filevue.app.api

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Singleton API client for FileVue server communication
 */
object ApiClient {
    private var baseUrl: String = ""
    private var authToken: String? = null
    private var csrfToken: String? = null
    private var retrofit: Retrofit? = null
    private var apiService: FileVueApiService? = null

    /**
     * Configure the API client with server URL
     */
    fun configure(serverUrl: String) {
        val url = serverUrl.trimEnd('/')
        if (url != baseUrl) {
            baseUrl = url
            retrofit = null
            apiService = null
        }
    }

    /**
     * Set the authentication token
     */
    fun setAuthToken(token: String?) {
        authToken = token
        // Reset service to apply new token
        apiService = null
    }

    /**
     * Set the CSRF token
     */
    fun setCsrfToken(token: String?) {
        csrfToken = token
    }

    /**
     * Get current CSRF token
     */
    fun getCsrfToken(): String? = csrfToken

    /**
     * Get current auth token
     */
    fun getAuthToken(): String? = authToken

    /**
     * Check if configured
     */
    fun isConfigured(): Boolean = baseUrl.isNotEmpty()

    /**
     * Get the base URL
     */
    fun getBaseUrl(): String = baseUrl

    /**
     * Clear all authentication data
     */
    fun clearAuth() {
        authToken = null
        csrfToken = null
        apiService = null
    }

    /**
     * Get the API service instance
     */
    fun getService(): FileVueApiService {
        if (!isConfigured()) {
            throw IllegalStateException("API client not configured. Call configure() first.")
        }

        if (apiService == null) {
            apiService = buildRetrofit().create(FileVueApiService::class.java)
        }
        return apiService!!
    }

    private fun buildRetrofit(): Retrofit {
        if (retrofit == null) {
            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val authInterceptor = Interceptor { chain ->
                val request = chain.request().newBuilder()
                
                // Add auth token if available
                authToken?.let { token ->
                    request.addHeader("Authorization", "Bearer $token")
                }
                
                chain.proceed(request.build())
            }

            val client = OkHttpClient.Builder()
                .addInterceptor(authInterceptor)
                .addInterceptor(loggingInterceptor)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .build()

            retrofit = Retrofit.Builder()
                .baseUrl("$baseUrl/")
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }
        return retrofit!!
    }

    /**
     * Reset the client (useful when changing servers)
     */
    fun reset() {
        baseUrl = ""
        authToken = null
        csrfToken = null
        retrofit = null
        apiService = null
    }
}
