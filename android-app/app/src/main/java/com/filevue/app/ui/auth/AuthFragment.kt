package com.filevue.app.ui.auth

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.filevue.app.R
import com.filevue.app.databinding.FragmentAuthBinding

/**
 * Fragment for server connection and authentication
 */
class AuthFragment : Fragment() {

    private var _binding: FragmentAuthBinding? = null
    private val binding get() = _binding!!

    private val viewModel: AuthViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAuthBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupListeners()
        setupObservers()
    }

    private fun setupListeners() {
        // Connect button
        binding.connectButton.setOnClickListener {
            val serverUrl = binding.serverUrlInput.text?.toString() ?: ""
            viewModel.configureServer(serverUrl)
            viewModel.checkAuthStatus()
        }

        // Server URL enter key
        binding.serverUrlInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                binding.connectButton.performClick()
                true
            } else {
                false
            }
        }

        // Login button
        binding.loginButton.setOnClickListener {
            val username = binding.usernameInput.text?.toString() ?: ""
            val password = binding.passwordInput.text?.toString() ?: ""
            viewModel.login(username, password)
        }

        // Password enter key
        binding.passwordInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                binding.loginButton.performClick()
                true
            } else {
                false
            }
        }
    }

    private fun setupObservers() {
        // Loading state
        viewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.progressIndicator.isVisible = isLoading
            binding.connectButton.isEnabled = !isLoading
            binding.loginButton.isEnabled = !isLoading
        }

        // Error messages
        viewModel.error.observe(viewLifecycleOwner) { error ->
            binding.errorText.isVisible = error != null
            binding.errorText.text = error
        }

        // Auth status - show login section if auth required
        viewModel.authStatus.observe(viewLifecycleOwner) { status ->
            status?.let {
                if (it.authRequired) {
                    binding.loginSection.isVisible = true
                    binding.usernameInput.requestFocus()
                } else {
                    // Auth not required, will automatically proceed
                    binding.loginSection.isVisible = false
                }
            }
        }

        // Server configured - update UI
        viewModel.serverConfigured.observe(viewLifecycleOwner) { configured ->
            binding.serverUrlLayout.isEnabled = !configured
            if (configured) {
                binding.connectButton.text = getString(R.string.connecting)
            } else {
                binding.connectButton.text = getString(R.string.connect)
                binding.loginSection.isVisible = false
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        fun newInstance() = AuthFragment()
    }
}
