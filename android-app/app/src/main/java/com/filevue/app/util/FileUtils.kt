package com.filevue.app.util

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import java.text.DecimalFormat
import java.text.SimpleDateFormat
import java.util.*

/**
 * Utility functions for file operations and formatting
 */
object FileUtils {

    private val fileSizeFormat = DecimalFormat("#,##0.##")
    private val dateFormat = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault())

    /**
     * Format file size to human-readable string
     */
    fun formatFileSize(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val units = arrayOf("B", "KB", "MB", "GB", "TB")
        val digitGroups = (Math.log10(bytes.toDouble()) / Math.log10(1024.0)).toInt()
        val size = bytes / Math.pow(1024.0, digitGroups.toDouble())
        return "${fileSizeFormat.format(size)} ${units[digitGroups]}"
    }

    /**
     * Format timestamp to human-readable date
     */
    fun formatDate(timestamp: Long): String {
        return dateFormat.format(Date(timestamp))
    }

    /**
     * Get file extension from name
     */
    fun getFileExtension(fileName: String): String {
        val lastDot = fileName.lastIndexOf('.')
        return if (lastDot > 0) fileName.substring(lastDot + 1).lowercase() else ""
    }

    /**
     * Check if file is an image based on extension or MIME type
     */
    fun isImage(fileName: String, mimeType: String?): Boolean {
        val imageExtensions = setOf("jpg", "jpeg", "png", "gif", "bmp", "webp", "svg")
        val extension = getFileExtension(fileName)
        return imageExtensions.contains(extension) || mimeType?.startsWith("image/") == true
    }

    /**
     * Check if file is a text file based on extension or MIME type
     */
    fun isTextFile(fileName: String, mimeType: String?): Boolean {
        val textExtensions = setOf(
            "txt", "md", "json", "xml", "html", "css", "js", "ts", "kt", "java",
            "py", "rb", "go", "rs", "c", "cpp", "h", "hpp", "yaml", "yml",
            "sh", "bash", "zsh", "fish", "ps1", "sql", "csv", "log", "ini", "conf",
            "properties", "gradle", "toml", "lock", "env"
        )
        val extension = getFileExtension(fileName)
        return textExtensions.contains(extension) || 
               mimeType?.startsWith("text/") == true ||
               mimeType == "application/json" ||
               mimeType == "application/xml"
    }

    /**
     * Check if file is a video
     */
    fun isVideo(fileName: String, mimeType: String?): Boolean {
        val videoExtensions = setOf("mp4", "webm", "mkv", "avi", "mov", "wmv", "flv")
        val extension = getFileExtension(fileName)
        return videoExtensions.contains(extension) || mimeType?.startsWith("video/") == true
    }

    /**
     * Check if file is audio
     */
    fun isAudio(fileName: String, mimeType: String?): Boolean {
        val audioExtensions = setOf("mp3", "wav", "ogg", "flac", "aac", "m4a", "wma")
        val extension = getFileExtension(fileName)
        return audioExtensions.contains(extension) || mimeType?.startsWith("audio/") == true
    }

    /**
     * Check if file is a PDF
     */
    fun isPdf(fileName: String, mimeType: String?): Boolean {
        return getFileExtension(fileName) == "pdf" || mimeType == "application/pdf"
    }

    /**
     * Check if file is an archive
     */
    fun isArchive(fileName: String, mimeType: String?): Boolean {
        val archiveExtensions = setOf("zip", "tar", "gz", "bz2", "7z", "rar", "xz")
        return archiveExtensions.contains(getFileExtension(fileName))
    }

    /**
     * Decode base64 image data to Bitmap
     */
    fun decodeBase64ToBitmap(base64Data: String): Bitmap? {
        return try {
            val decodedBytes = Base64.decode(base64Data, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Get a simple icon description for the file type
     */
    fun getFileTypeDescription(fileName: String, mimeType: String?, isDirectory: Boolean): String {
        return when {
            isDirectory -> "Folder"
            isImage(fileName, mimeType) -> "Image"
            isTextFile(fileName, mimeType) -> "Text"
            isVideo(fileName, mimeType) -> "Video"
            isAudio(fileName, mimeType) -> "Audio"
            isPdf(fileName, mimeType) -> "PDF"
            isArchive(fileName, mimeType) -> "Archive"
            else -> "File"
        }
    }
}
