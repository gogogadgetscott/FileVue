package com.filevue.app.ui.preview

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.filevue.app.data.FilePreview
import com.filevue.app.data.FileVueRepository
import com.filevue.app.data.ThumbnailPayload
import kotlinx.coroutines.launch

/**
 * ViewModel for file preview functionality
 */
class PreviewViewModel : ViewModel() {

    private val repository = FileVueRepository()

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    private val _filePreview = MutableLiveData<FilePreview?>()
    val filePreview: LiveData<FilePreview?> = _filePreview

    private val _thumbnail = MutableLiveData<ThumbnailPayload?>()
    val thumbnail: LiveData<ThumbnailPayload?> = _thumbnail

    /**
     * Load file content/preview
     */
    fun loadFileContent(path: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null

            when (val result = repository.getFileContent(path)) {
                is FileVueRepository.Result.Success -> {
                    _filePreview.value = result.data
                }
                is FileVueRepository.Result.Error -> {
                    _error.value = result.message
                }
            }
            _isLoading.value = false
        }
    }

    /**
     * Load thumbnail for image
     */
    fun loadThumbnail(path: String) {
        viewModelScope.launch {
            when (val result = repository.getThumbnail(path)) {
                is FileVueRepository.Result.Success -> {
                    _thumbnail.value = result.data
                }
                is FileVueRepository.Result.Error -> {
                    // Thumbnail load failure is not critical
                }
            }
        }
    }

    /**
     * Clear error
     */
    fun clearError() {
        _error.value = null
    }
}
