package com.filevue.app.data

import com.google.gson.annotations.SerializedName

/**
 * Represents a file or directory entry from the FileVue API
 */
data class Entry(
    @SerializedName("name") val name: String,
    @SerializedName("path") val path: String,
    @SerializedName("isDirectory") val isDirectory: Boolean,
    @SerializedName("size") val size: Long,
    @SerializedName("modified") val modified: Long,
    @SerializedName("mimeType") val mimeType: String?
)

/**
 * Server metadata response
 */
data class ExplorerMeta(
    @SerializedName("version") val version: String,
    @SerializedName("rootDirectory") val rootDirectory: String,
    @SerializedName("readOnly") val readOnly: Boolean,
    @SerializedName("maxPreviewBytes") val maxPreviewBytes: Long,
    @SerializedName("imagePreviewMaxBytes") val imagePreviewMaxBytes: Long,
    @SerializedName("thumbnailMaxBytes") val thumbnailMaxBytes: Long
)

/**
 * Authentication status response
 */
data class AuthStatus(
    @SerializedName("authRequired") val authRequired: Boolean,
    @SerializedName("authenticated") val authenticated: Boolean?,
    @SerializedName("sessionTtlSeconds") val sessionTtlSeconds: Int
)

/**
 * Login request body
 */
data class LoginRequest(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String
)

/**
 * Login response
 */
data class LoginResponse(
    @SerializedName("token") val token: String?,
    @SerializedName("error") val error: String?
)

/**
 * File preview response
 */
data class FilePreview(
    @SerializedName("name") val name: String,
    @SerializedName("path") val path: String,
    @SerializedName("size") val size: Long,
    @SerializedName("modified") val modified: Long,
    @SerializedName("encoding") val encoding: String,
    @SerializedName("content") val content: String,
    @SerializedName("mimeType") val mimeType: String?,
    @SerializedName("previewType") val previewType: String,
    @SerializedName("note") val note: String?
)

/**
 * Thumbnail response
 */
data class ThumbnailPayload(
    @SerializedName("path") val path: String,
    @SerializedName("mimeType") val mimeType: String,
    @SerializedName("encoding") val encoding: String,
    @SerializedName("content") val content: String
)

/**
 * Create folder request
 */
data class CreateFolderRequest(
    @SerializedName("parentPath") val parentPath: String,
    @SerializedName("name") val name: String
)

/**
 * Create file request
 */
data class CreateFileRequest(
    @SerializedName("parentPath") val parentPath: String,
    @SerializedName("name") val name: String,
    @SerializedName("content") val content: String,
    @SerializedName("encoding") val encoding: String = "utf8"
)

/**
 * Generic error response
 */
data class ErrorResponse(
    @SerializedName("error") val error: String
)

/**
 * Directory tree response
 */
data class TreeResponse(
    @SerializedName("entries") val entries: List<Entry>,
    @SerializedName("path") val path: String,
    @SerializedName("parentPath") val parentPath: String?
)

/**
 * Search result response
 */
data class SearchResult(
    @SerializedName("query") val query: String,
    @SerializedName("path") val path: String,
    @SerializedName("results") val results: List<Entry>,
    @SerializedName("resultCount") val resultCount: Int,
    @SerializedName("truncated") val truncated: Boolean,
    @SerializedName("timedOut") val timedOut: Boolean,
    @SerializedName("durationMs") val durationMs: Long
)
