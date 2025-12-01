package com.filevue.app.api

import com.filevue.app.data.*
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit service interface for the FileVue API
 */
interface FileVueApiService {

    /**
     * Get server metadata including read-only status and preview limits
     */
    @GET("api/meta")
    suspend fun getMeta(): Response<ExplorerMeta>

    /**
     * Get authentication status
     */
    @GET("api/auth/status")
    suspend fun getAuthStatus(): Response<AuthStatus>

    /**
     * Login to get JWT token
     */
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    /**
     * Logout and invalidate session
     */
    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>

    /**
     * List directory contents
     */
    @GET("api/tree")
    suspend fun getTree(@Query("path") path: String = "."): Response<TreeResponse>

    /**
     * Get file content/preview
     */
    @GET("api/file/content")
    suspend fun getFileContent(@Query("path") path: String): Response<FilePreview>

    /**
     * Get thumbnail for image files
     */
    @GET("api/file/thumbnail")
    suspend fun getThumbnail(@Query("path") path: String): Response<ThumbnailPayload>

    /**
     * Download file
     */
    @Streaming
    @GET("api/file/download")
    suspend fun downloadFile(@Query("path") path: String): Response<ResponseBody>

    /**
     * Create a new folder
     */
    @POST("api/folders")
    suspend fun createFolder(
        @Body request: CreateFolderRequest,
        @Header("X-CSRF-Token") csrfToken: String? = null
    ): Response<Entry>

    /**
     * Create a new file
     */
    @POST("api/files")
    suspend fun createFile(
        @Body request: CreateFileRequest,
        @Header("X-CSRF-Token") csrfToken: String? = null
    ): Response<Entry>

    /**
     * Delete a file or folder
     */
    @DELETE("api/entries")
    suspend fun deleteEntry(
        @Query("path") path: String,
        @Header("X-CSRF-Token") csrfToken: String? = null
    ): Response<Unit>

    /**
     * Search for files
     */
    @GET("api/search")
    suspend fun search(
        @Query("q") query: String,
        @Query("path") path: String = "."
    ): Response<SearchResult>
}
