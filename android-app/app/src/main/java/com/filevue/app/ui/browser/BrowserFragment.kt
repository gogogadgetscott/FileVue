package com.filevue.app.ui.browser

import android.content.Intent
import android.os.Bundle
import android.os.Environment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.PopupMenu
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.recyclerview.widget.DividerItemDecoration
import androidx.recyclerview.widget.LinearLayoutManager
import com.filevue.app.R
import com.filevue.app.data.Entry
import com.filevue.app.databinding.FragmentBrowserBinding
import com.filevue.app.ui.preview.PreviewActivity
import com.google.android.material.dialog.MaterialAlertDialogBuilder

/**
 * Fragment for browsing files and directories
 */
class BrowserFragment : Fragment() {

    private var _binding: FragmentBrowserBinding? = null
    private val binding get() = _binding!!

    private val viewModel: BrowserViewModel by activityViewModels()
    private lateinit var adapter: EntryAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentBrowserBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupSwipeRefresh()
        setupObservers()
    }

    private fun setupRecyclerView() {
        adapter = EntryAdapter(
            onItemClick = { entry ->
                if (entry.isDirectory) {
                    viewModel.navigateTo(entry.path)
                } else {
                    // Open preview
                    openPreview(entry)
                }
            },
            onMoreClick = { entry, anchor ->
                showContextMenu(entry, anchor)
            }
        )

        binding.entriesRecyclerView.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@BrowserFragment.adapter
            addItemDecoration(DividerItemDecoration(requireContext(), DividerItemDecoration.VERTICAL))
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            viewModel.refresh()
        }
    }

    private fun setupObservers() {
        // Loading state
        viewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.swipeRefresh.isRefreshing = isLoading
            binding.progressIndicator.isVisible = isLoading && adapter.itemCount == 0
        }

        // Entries list
        viewModel.entries.observe(viewLifecycleOwner) { entries ->
            adapter.submitList(entries)
            binding.emptyState.isVisible = entries.isEmpty() && viewModel.isLoading.value != true
            
            // Update empty state text based on search mode
            if (viewModel.isSearchMode.value == true) {
                binding.emptyStateText.text = getString(R.string.no_results)
            } else {
                binding.emptyStateText.text = getString(R.string.empty_directory)
            }
        }
    }

    private fun openPreview(entry: Entry) {
        val intent = Intent(requireContext(), PreviewActivity::class.java).apply {
            putExtra(PreviewActivity.EXTRA_FILE_PATH, entry.path)
            putExtra(PreviewActivity.EXTRA_FILE_NAME, entry.name)
        }
        startActivity(intent)
    }

    private fun showContextMenu(entry: Entry, anchor: View) {
        val popup = PopupMenu(requireContext(), anchor)
        popup.menuInflater.inflate(R.menu.menu_entry_context, popup.menu)

        // Hide delete if read-only
        val isReadOnly = viewModel.meta.value?.readOnly == true
        popup.menu.findItem(R.id.action_delete)?.isVisible = !isReadOnly

        popup.setOnMenuItemClickListener { menuItem ->
            when (menuItem.itemId) {
                R.id.action_download -> {
                    downloadEntry(entry)
                    true
                }
                R.id.action_delete -> {
                    confirmDelete(entry)
                    true
                }
                else -> false
            }
        }
        popup.show()
    }

    private fun downloadEntry(entry: Entry) {
        val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        viewModel.downloadFile(entry, downloadDir)
    }

    private fun confirmDelete(entry: Entry) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle(R.string.delete)
            .setMessage(getString(R.string.delete_confirmation, entry.name))
            .setPositiveButton(R.string.delete) { _, _ ->
                viewModel.deleteEntry(entry)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        fun newInstance() = BrowserFragment()
    }
}
