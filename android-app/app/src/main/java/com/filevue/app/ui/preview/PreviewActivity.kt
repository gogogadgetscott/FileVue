package com.filevue.app.ui.preview

import android.graphics.Bitmap
import android.os.Bundle
import android.os.Environment
import android.util.Base64
import android.view.MenuItem
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import com.filevue.app.R
import com.filevue.app.data.FilePreview
import com.filevue.app.databinding.ActivityPreviewBinding
import com.filevue.app.util.FileUtils
import com.google.android.material.snackbar.Snackbar
import java.io.File

/**
 * Activity for previewing file contents
 */
class PreviewActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPreviewBinding
    private val viewModel: PreviewViewModel by viewModels()

    private var filePath: String = ""
    private var fileName: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPreviewBinding.inflate(layoutInflater)
        setContentView(binding.root)

        filePath = intent.getStringExtra(EXTRA_FILE_PATH) ?: ""
        fileName = intent.getStringExtra(EXTRA_FILE_NAME) ?: ""

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = fileName

        setupObservers()
        setupDownloadButton()

        if (filePath.isNotEmpty()) {
            viewModel.loadFileContent(filePath)
        }
    }

    private fun setupObservers() {
        // Loading state
        viewModel.isLoading.observe(this) { isLoading ->
            binding.progressIndicator.isVisible = isLoading
            binding.infoCard.isVisible = !isLoading
        }

        // File preview
        viewModel.filePreview.observe(this) { preview ->
            preview?.let { displayPreview(it) }
        }

        // Downloading state
        viewModel.isDownloading.observe(this) { isDownloading ->
            binding.downloadButton.isEnabled = !isDownloading
            binding.downloadButton.text = if (isDownloading) {
                getString(R.string.loading)
            } else {
                getString(R.string.download)
            }
        }

        // Download success
        viewModel.downloadSuccess.observe(this) { path ->
            path?.let {
                Snackbar.make(binding.root, "Downloaded to: $it", Snackbar.LENGTH_LONG).show()
                viewModel.clearDownloadSuccess()
            }
        }

        // Error
        viewModel.error.observe(this) { error ->
            error?.let {
                Snackbar.make(binding.root, it, Snackbar.LENGTH_LONG).show()
                viewModel.clearError()
            }
        }
    }

    private fun displayPreview(preview: FilePreview) {
        // Update file info
        binding.fileName.text = preview.name
        binding.fileSize.text = getString(R.string.size, FileUtils.formatFileSize(preview.size))
        binding.fileModified.text = getString(R.string.modified, FileUtils.formatDate(preview.modified))
        binding.fileType.text = getString(R.string.type, preview.mimeType ?: "Unknown")

        // Display content based on preview type
        when (preview.previewType) {
            "image" -> showImagePreview(preview)
            "text" -> showTextPreview(preview)
            "binary" -> showBinaryMessage()
            else -> showNoPreview()
        }
    }

    private fun showImagePreview(preview: FilePreview) {
        binding.imagePreview.isVisible = true
        binding.textPreviewCard.isVisible = false
        binding.binaryMessage.isVisible = false
        binding.noPreviewMessage.isVisible = false

        // Decode base64 image
        try {
            val imageBytes = Base64.decode(preview.content, Base64.DEFAULT)
            val bitmap = android.graphics.BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            binding.imagePreview.setImageBitmap(bitmap)
        } catch (e: Exception) {
            binding.imagePreview.isVisible = false
            binding.noPreviewMessage.isVisible = true
        }
    }

    private fun showTextPreview(preview: FilePreview) {
        binding.imagePreview.isVisible = false
        binding.textPreviewCard.isVisible = true
        binding.binaryMessage.isVisible = false
        binding.noPreviewMessage.isVisible = false

        // Decode content if base64
        val content = if (preview.encoding == "base64") {
            try {
                String(Base64.decode(preview.content, Base64.DEFAULT))
            } catch (e: Exception) {
                preview.content
            }
        } else {
            preview.content
        }

        binding.textPreview.text = content

        // Show note if content was truncated
        preview.note?.let { note ->
            Snackbar.make(binding.root, note, Snackbar.LENGTH_SHORT).show()
        }
    }

    private fun showBinaryMessage() {
        binding.imagePreview.isVisible = false
        binding.textPreviewCard.isVisible = false
        binding.binaryMessage.isVisible = true
        binding.noPreviewMessage.isVisible = false
    }

    private fun showNoPreview() {
        binding.imagePreview.isVisible = false
        binding.textPreviewCard.isVisible = false
        binding.binaryMessage.isVisible = false
        binding.noPreviewMessage.isVisible = true
    }

    private fun setupDownloadButton() {
        binding.downloadButton.setOnClickListener {
            downloadFile()
        }
    }

    private fun downloadFile() {
        if (filePath.isEmpty()) return

        val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val destination = File(downloadDir, fileName)

        viewModel.downloadFile(filePath, destination)
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            android.R.id.home -> {
                finish()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    companion object {
        const val EXTRA_FILE_PATH = "extra_file_path"
        const val EXTRA_FILE_NAME = "extra_file_name"
    }
}
