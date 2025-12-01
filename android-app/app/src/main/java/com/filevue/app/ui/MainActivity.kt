package com.filevue.app.ui

import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.view.inputmethod.EditorInfo
import androidx.activity.OnBackPressedCallback
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import com.filevue.app.R
import com.filevue.app.databinding.ActivityMainBinding
import com.filevue.app.ui.auth.AuthFragment
import com.filevue.app.ui.auth.AuthViewModel
import com.filevue.app.ui.browser.BrowserFragment
import com.filevue.app.ui.browser.BrowserViewModel
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar

/**
 * Main Activity hosting auth and browser fragments
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val authViewModel: AuthViewModel by viewModels()
    private val browserViewModel: BrowserViewModel by viewModels()

    private var authFragment: AuthFragment? = null
    private var browserFragment: BrowserFragment? = null
    private var isInBrowserMode = false
    private var optionsMenu: Menu? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setSupportActionBar(binding.toolbar)
        setupObservers()
        setupSearchInput()
        setupBackHandler()
        setupFab()

        // Start with auth fragment
        if (savedInstanceState == null) {
            showAuthFragment()
        }
    }

    private fun setupObservers() {
        // Auth success - transition to browser
        authViewModel.loginSuccess.observe(this) { success ->
            if (success) {
                showBrowserFragment()
            }
        }

        // Server disconnected - return to auth
        authViewModel.serverConfigured.observe(this) { configured ->
            if (!configured && isInBrowserMode) {
                showAuthFragment()
            }
        }

        // Browser path changes - update toolbar title
        browserViewModel.currentPath.observe(this) { path ->
            if (isInBrowserMode) {
                val displayPath = if (path == ".") "Root" else path
                supportActionBar?.title = displayPath
            }
        }

        // Show/hide up button based on parent availability
        browserViewModel.parentPath.observe(this) { parent ->
            if (isInBrowserMode) {
                supportActionBar?.setDisplayHomeAsUpEnabled(parent != null)
            }
        }

        // Read-only mode indication
        browserViewModel.meta.observe(this) { meta ->
            if (meta?.readOnly == true && isInBrowserMode) {
                Snackbar.make(binding.root, R.string.read_only_mode, Snackbar.LENGTH_SHORT).show()
            }
            // Show/hide FAB based on read-only mode
            binding.fab.isVisible = isInBrowserMode && meta?.readOnly != true
        }

        // Browser errors
        browserViewModel.error.observe(this) { error ->
            error?.let {
                Snackbar.make(binding.root, it, Snackbar.LENGTH_LONG).show()
                browserViewModel.clearError()
            }
        }

        // Operation success messages
        browserViewModel.operationSuccess.observe(this) { message ->
            message?.let {
                Snackbar.make(binding.root, it, Snackbar.LENGTH_SHORT).show()
                browserViewModel.clearOperationSuccess()
            }
        }
    }

    private fun setupSearchInput() {
        binding.searchInput.setOnEditorActionListener { v, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                browserViewModel.search(v.text.toString())
                true
            } else {
                false
            }
        }

        binding.searchLayout.setEndIconOnClickListener {
            binding.searchInput.text?.clear()
            browserViewModel.exitSearch()
            hideSearch()
        }
    }

    private fun setupBackHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    // Exit search mode first
                    browserViewModel.isSearchMode.value == true -> {
                        browserViewModel.exitSearch()
                        hideSearch()
                    }
                    // Hide search bar if visible
                    binding.searchLayout.isVisible -> {
                        hideSearch()
                    }
                    // Navigate back in browser
                    isInBrowserMode && browserViewModel.navigateBack() -> {
                        // Handled by navigateBack
                    }
                    // Go to auth screen if in browser
                    isInBrowserMode -> {
                        // Ask if user wants to disconnect
                        showDisconnectConfirmation()
                    }
                    // Default behavior
                    else -> {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })
    }

    private fun setupFab() {
        binding.fab.setOnClickListener {
            showCreateOptionsDialog()
        }
    }

    private fun showAuthFragment() {
        isInBrowserMode = false
        binding.authContainer.visibility = View.VISIBLE
        binding.browserContainer.visibility = View.GONE
        binding.fab.visibility = View.GONE
        binding.searchLayout.visibility = View.GONE

        supportActionBar?.title = getString(R.string.app_name)
        supportActionBar?.setDisplayHomeAsUpEnabled(false)
        invalidateOptionsMenu()

        authFragment = AuthFragment.newInstance()
        supportFragmentManager.beginTransaction()
            .replace(R.id.authContainer, authFragment!!)
            .commit()
    }

    private fun showBrowserFragment() {
        isInBrowserMode = true
        binding.authContainer.visibility = View.GONE
        binding.browserContainer.visibility = View.VISIBLE
        binding.fab.visibility = View.VISIBLE

        invalidateOptionsMenu()

        browserFragment = BrowserFragment.newInstance()
        supportFragmentManager.beginTransaction()
            .replace(R.id.browserContainer, browserFragment!!)
            .commit()

        // Load initial data
        browserViewModel.loadMeta()
        browserViewModel.navigateTo(".")
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        if (isInBrowserMode) {
            menuInflater.inflate(R.menu.menu_browser, menu)
            optionsMenu = menu
            
            // Hide create options if read-only
            val readOnly = browserViewModel.meta.value?.readOnly == true
            menu.findItem(R.id.action_create_folder)?.isVisible = !readOnly
            menu.findItem(R.id.action_create_file)?.isVisible = !readOnly
        }
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            android.R.id.home -> {
                browserViewModel.navigateUp()
                true
            }
            R.id.action_search -> {
                showSearch()
                true
            }
            R.id.action_refresh -> {
                browserViewModel.refresh()
                true
            }
            R.id.action_create_folder -> {
                showCreateFolderDialog()
                true
            }
            R.id.action_create_file -> {
                showCreateFileDialog()
                true
            }
            R.id.action_logout -> {
                authViewModel.logout()
                showAuthFragment()
                true
            }
            R.id.action_disconnect -> {
                showDisconnectConfirmation()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun showSearch() {
        binding.searchLayout.visibility = View.VISIBLE
        binding.searchInput.requestFocus()
    }

    private fun hideSearch() {
        binding.searchLayout.visibility = View.GONE
        binding.searchInput.text?.clear()
    }

    private fun showCreateOptionsDialog() {
        val options = arrayOf(getString(R.string.create_folder), getString(R.string.create_file))
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.create)
            .setItems(options) { _, which ->
                when (which) {
                    0 -> showCreateFolderDialog()
                    1 -> showCreateFileDialog()
                }
            }
            .show()
    }

    private fun showCreateFolderDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_create, null)
        val nameInput = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.nameInput)
        val contentLayout = dialogView.findViewById<com.google.android.material.textfield.TextInputLayout>(R.id.contentLayout)
        contentLayout.visibility = View.GONE
        nameInput.hint = getString(R.string.folder_name)

        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.create_folder)
            .setView(dialogView)
            .setPositiveButton(R.string.create) { _, _ ->
                val name = nameInput.text?.toString() ?: ""
                browserViewModel.createFolder(name)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showCreateFileDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_create, null)
        val nameInput = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.nameInput)
        val contentLayout = dialogView.findViewById<com.google.android.material.textfield.TextInputLayout>(R.id.contentLayout)
        val contentInput = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.contentInput)
        contentLayout.visibility = View.VISIBLE
        nameInput.hint = getString(R.string.file_name)

        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.create_file)
            .setView(dialogView)
            .setPositiveButton(R.string.create) { _, _ ->
                val name = nameInput.text?.toString() ?: ""
                val content = contentInput.text?.toString() ?: ""
                browserViewModel.createFile(name, content)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showDisconnectConfirmation() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.disconnect)
            .setMessage("Are you sure you want to disconnect from the server?")
            .setPositiveButton(R.string.disconnect) { _, _ ->
                authViewModel.disconnectServer()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }
}
