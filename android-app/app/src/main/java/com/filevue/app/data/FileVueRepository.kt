package com.filevue.app.data

import com.filevue.app.api.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.ResponseBody
import java.io.File
import java.io.FileOutputStream

/**
 * Repository for FileVue data operations
 */
class FileVueRepository {

    private val api get() = ApiClient.getService()

    /**
     * Result wrapper for API operations
     */
    sealed class Result<out T> {
        data class Success<T>(val data: T) : Result<T>()
        data class Error(val message: String) : Result<Nothing>()
    }

    /**
     * Get server metadata
     */
    suspend fun getMeta(): Result<ExplorerMeta> = withContext(Dispatchers.IO) {
        try {
            val response = api.getMeta()
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.errorBody()?.string() ?: "Failed to get metadata")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get authentication status
     */
    suspend fun getAuthStatus(): Result<AuthStatus> = withContext(Dispatchers.IO) {
        try {
            val response = api.getAuthStatus()
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.errorBody()?.string() ?: "Failed to get auth status")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Login to the server
     */
    suspend fun login(username: String, password: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val response = api.login(LoginRequest(username, password))
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.token != null) {
                    ApiClient.setAuthToken(body.token)
                    Result.Success(body.token)
                } else if (body?.error != null) {
                    Result.Error(body.error)
                } else {
                    Result.Success("") // No token returned, but login was successful
                }
            } else {
                Result.Error(response.errorBody()?.string() ?: "Login failed")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Logout from the server
     */
    suspend fun logout(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            api.logout()
            ApiClient.clearAuth()
            Result.Success(Unit)
        } catch (e: Exception) {
            ApiClient.clearAuth()
            Result.Success(Unit) // Clear local auth even if server call fails
        }
    }

    /**
     * Get directory contents
     */
    suspend fun getTree(path: String = "."): Result<TreeResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.getTree(path)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.errorBody()?.string() ?: "Failed to get directory contents")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get file preview/content
     */
    suspend fun getFileContent(path: String): Result<FilePreview> = withContext(Dispatchers.IO) {
        try {
            val response = api.getFileContent(path)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.errorBody()?.string() ?: "Failed to get file content")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get thumbnail for image files
     */
    suspend fun getThumbnail(path: String): Result<ThumbnailPayload> = withContext(Dispatchers.IO) {
        try {
            val response = api.getThumbnail(path)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.errorBody()?.string() ?: "Failed to get thumbnail")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Download file to specified destination
     */
    suspend fun downloadFile(path: String, destination: File): Result<File> = withContext(Dispatchers.IO) {
        try {
            val response = api.downloadFile(path)
            if (response.isSuccessful && response.body() != null) {
                writeResponseBodyToDisk(response.body()!!, destination)
                Result.Success(destination)
            } else {
                Result.Error(response.errorBody()?.string() ?: "Failed to download file")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Download error")
        }
    }

    private fun writeResponseBodyToDisk(body: ResponseBody, file: File): Boolean {
        return try {
            file.parentFile?.mkdirs()
            FileOutputStream(file).use { fos ->
                body.byteStream().use { inputStream ->
                    inputStream.copyTo(fos)
                }
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Create a new folder
     */
    suspend fun createFolder(parentPath: String, name: String): Result<Entry> = withContext(Dispatchers.IO) {
        try {
            val response = api.createFolder(
                CreateFolderRequest(parentPath, name),
                ApiClient.getCsrfToken()
            )
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.errorBody()?.string() ?: "Failed to create folder")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Create a new file
     */
    suspend fun createFile(parentPath: String, name: String, content: String): Result<Entry> = withContext(Dispatchers.IO) {
        try {
            val response = api.createFile(
                CreateFileRequest(parentPath, name, content),
                ApiClient.getCsrfToken()
            )
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.errorBody()?.string() ?: "Failed to create file")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Delete a file or folder
     */
    suspend fun deleteEntry(path: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.deleteEntry(path, ApiClient.getCsrfToken())
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error(response.errorBody()?.string() ?: "Failed to delete")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }

    /**
     * Search for files
     */
    suspend fun search(query: String, path: String = "."): Result<SearchResult> = withContext(Dispatchers.IO) {
        try {
            val response = api.search(query, path)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(response.errorBody()?.string() ?: "Search failed")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
}
