package com.filevue.app.ui.auth

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.filevue.app.api.ApiClient
import com.filevue.app.data.AuthStatus
import com.filevue.app.data.FileVueRepository
import com.filevue.app.util.SecureStorage
import kotlinx.coroutines.launch

/**
 * ViewModel for authentication/login functionality
 */
class AuthViewModel : ViewModel() {

    private val repository = FileVueRepository()

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    private val _authStatus = MutableLiveData<AuthStatus?>()
    val authStatus: LiveData<AuthStatus?> = _authStatus

    private val _loginSuccess = MutableLiveData(false)
    val loginSuccess: LiveData<Boolean> = _loginSuccess

    private val _serverConfigured = MutableLiveData(ApiClient.isConfigured())
    val serverConfigured: LiveData<Boolean> = _serverConfigured

    /**
     * Configure server URL
     */
    fun configureServer(serverUrl: String) {
        if (serverUrl.isBlank()) {
            _error.value = "Server URL is required"
            return
        }

        val url = serverUrl.trim().let {
            if (!it.startsWith("http://") && !it.startsWith("https://")) {
                "http://$it"
            } else {
                it
            }
        }

        ApiClient.configure(url)
        SecureStorage.saveServerUrl(url)
        _serverConfigured.value = true
        _error.value = null
    }

    /**
     * Check authentication status from server
     */
    fun checkAuthStatus() {
        if (!ApiClient.isConfigured()) {
            _error.value = "Server not configured"
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null

            when (val result = repository.getAuthStatus()) {
                is FileVueRepository.Result.Success -> {
                    _authStatus.value = result.data
                    // If auth not required, consider as logged in
                    if (!result.data.authRequired) {
                        _loginSuccess.value = true
                    }
                }
                is FileVueRepository.Result.Error -> {
                    _error.value = result.message
                }
            }
            _isLoading.value = false
        }
    }

    /**
     * Login with username and password
     */
    fun login(username: String, password: String) {
        if (username.isBlank() || password.isBlank()) {
            _error.value = "Username and password are required"
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null

            when (val result = repository.login(username, password)) {
                is FileVueRepository.Result.Success -> {
                    SecureStorage.saveAuthToken(result.data)
                    SecureStorage.saveUsername(username)
                    _loginSuccess.value = true
                }
                is FileVueRepository.Result.Error -> {
                    _error.value = result.message
                }
            }
            _isLoading.value = false
        }
    }

    /**
     * Logout from server
     */
    fun logout() {
        viewModelScope.launch {
            repository.logout()
            SecureStorage.clearAuthToken()
            _loginSuccess.value = false
            _authStatus.value = null
        }
    }

    /**
     * Disconnect from server and clear all data
     */
    fun disconnectServer() {
        ApiClient.reset()
        SecureStorage.clearAll()
        _serverConfigured.value = false
        _loginSuccess.value = false
        _authStatus.value = null
    }

    /**
     * Clear error message
     */
    fun clearError() {
        _error.value = null
    }
}
