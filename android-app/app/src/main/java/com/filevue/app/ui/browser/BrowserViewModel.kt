package com.filevue.app.ui.browser

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.filevue.app.data.Entry
import com.filevue.app.data.ExplorerMeta
import com.filevue.app.data.FileVueRepository
import com.filevue.app.data.SearchResult
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.util.*

/**
 * ViewModel for file browser functionality
 */
class BrowserViewModel : ViewModel() {

    private val repository = FileVueRepository()

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    private val _meta = MutableLiveData<ExplorerMeta?>()
    val meta: LiveData<ExplorerMeta?> = _meta

    private val _entries = MutableLiveData<List<Entry>>(emptyList())
    val entries: LiveData<List<Entry>> = _entries

    private val _currentPath = MutableLiveData(".")
    val currentPath: LiveData<String> = _currentPath

    private val _parentPath = MutableLiveData<String?>(null)
    val parentPath: LiveData<String?> = _parentPath

    private val _pathHistory = MutableLiveData<Stack<String>>(Stack())
    val pathHistory: LiveData<Stack<String>> = _pathHistory

    private val _searchResults = MutableLiveData<SearchResult?>()
    val searchResults: LiveData<SearchResult?> = _searchResults

    private val _isSearchMode = MutableLiveData(false)
    val isSearchMode: LiveData<Boolean> = _isSearchMode

    private val _downloadProgress = MutableLiveData<Pair<String, Int>?>()
    val downloadProgress: LiveData<Pair<String, Int>?> = _downloadProgress

    private val _operationSuccess = MutableLiveData<String?>()
    val operationSuccess: LiveData<String?> = _operationSuccess

    private var searchJob: Job? = null

    /**
     * Load server metadata
     */
    fun loadMeta() {
        viewModelScope.launch {
            when (val result = repository.getMeta()) {
                is FileVueRepository.Result.Success -> {
                    _meta.value = result.data
                }
                is FileVueRepository.Result.Error -> {
                    _error.value = result.message
                }
            }
        }
    }

    /**
     * Navigate to a directory
     */
    fun navigateTo(path: String, addToHistory: Boolean = true) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            _isSearchMode.value = false
            _searchResults.value = null

            // Add current path to history before navigating
            if (addToHistory && _currentPath.value != path) {
                val history = _pathHistory.value ?: Stack()
                _currentPath.value?.let { history.push(it) }
                _pathHistory.value = history
            }

            when (val result = repository.getTree(path)) {
                is FileVueRepository.Result.Success -> {
                    _entries.value = sortEntries(result.data.entries)
                    _currentPath.value = result.data.path
                    _parentPath.value = result.data.parentPath
                }
                is FileVueRepository.Result.Error -> {
                    _error.value = result.message
                }
            }
            _isLoading.value = false
        }
    }

    /**
     * Navigate back in history
     */
    fun navigateBack(): Boolean {
        val history = _pathHistory.value
        if (history != null && history.isNotEmpty()) {
            val previousPath = history.pop()
            _pathHistory.value = history
            navigateTo(previousPath, addToHistory = false)
            return true
        }
        return false
    }

    /**
     * Navigate to parent directory
     */
    fun navigateUp(): Boolean {
        val parent = _parentPath.value
        return if (parent != null) {
            navigateTo(parent)
            true
        } else {
            false
        }
    }

    /**
     * Refresh current directory
     */
    fun refresh() {
        _currentPath.value?.let { navigateTo(it, addToHistory = false) }
    }

    /**
     * Search for files
     */
    fun search(query: String) {
        if (query.isBlank()) {
            exitSearch()
            return
        }

        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(300) // Debounce
            _isLoading.value = true
            _error.value = null
            _isSearchMode.value = true

            when (val result = repository.search(query, _currentPath.value ?: ".")) {
                is FileVueRepository.Result.Success -> {
                    _searchResults.value = result.data
                    _entries.value = sortEntries(result.data.results)
                }
                is FileVueRepository.Result.Error -> {
                    _error.value = result.message
                }
            }
            _isLoading.value = false
        }
    }

    /**
     * Exit search mode
     */
    fun exitSearch() {
        _isSearchMode.value = false
        _searchResults.value = null
        refresh()
    }

    /**
     * Download a file
     */
    fun downloadFile(entry: Entry, downloadDir: File) {
        viewModelScope.launch {
            val destination = File(downloadDir, entry.name)
            _downloadProgress.value = entry.name to 0

            when (val result = repository.downloadFile(entry.path, destination)) {
                is FileVueRepository.Result.Success -> {
                    _downloadProgress.value = null
                    _operationSuccess.value = "Downloaded: ${entry.name}"
                }
                is FileVueRepository.Result.Error -> {
                    _downloadProgress.value = null
                    _error.value = result.message
                }
            }
        }
    }

    /**
     * Create a new folder
     */
    fun createFolder(name: String) {
        if (name.isBlank()) {
            _error.value = "Folder name is required"
            return
        }

        if (_meta.value?.readOnly == true) {
            _error.value = "Server is in read-only mode"
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.createFolder(_currentPath.value ?: ".", name)) {
                is FileVueRepository.Result.Success -> {
                    _operationSuccess.value = "Created folder: $name"
                    refresh()
                }
                is FileVueRepository.Result.Error -> {
                    _error.value = result.message
                }
            }
            _isLoading.value = false
        }
    }

    /**
     * Create a new text file
     */
    fun createFile(name: String, content: String = "") {
        if (name.isBlank()) {
            _error.value = "File name is required"
            return
        }

        if (_meta.value?.readOnly == true) {
            _error.value = "Server is in read-only mode"
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.createFile(_currentPath.value ?: ".", name, content)) {
                is FileVueRepository.Result.Success -> {
                    _operationSuccess.value = "Created file: $name"
                    refresh()
                }
                is FileVueRepository.Result.Error -> {
                    _error.value = result.message
                }
            }
            _isLoading.value = false
        }
    }

    /**
     * Delete a file or folder
     */
    fun deleteEntry(entry: Entry) {
        if (_meta.value?.readOnly == true) {
            _error.value = "Server is in read-only mode"
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            when (val result = repository.deleteEntry(entry.path)) {
                is FileVueRepository.Result.Success -> {
                    _operationSuccess.value = "Deleted: ${entry.name}"
                    refresh()
                }
                is FileVueRepository.Result.Error -> {
                    _error.value = result.message
                }
            }
            _isLoading.value = false
        }
    }

    /**
     * Sort entries - directories first, then alphabetically
     */
    private fun sortEntries(entries: List<Entry>): List<Entry> {
        return entries.sortedWith(
            compareByDescending<Entry> { it.isDirectory }
                .thenBy { it.name.lowercase() }
        )
    }

    /**
     * Clear error message
     */
    fun clearError() {
        _error.value = null
    }

    /**
     * Clear operation success message
     */
    fun clearOperationSuccess() {
        _operationSuccess.value = null
    }
}
