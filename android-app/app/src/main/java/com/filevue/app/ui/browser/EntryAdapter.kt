package com.filevue.app.ui.browser

import android.graphics.drawable.GradientDrawable
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.filevue.app.R
import com.filevue.app.data.Entry
import com.filevue.app.databinding.ItemEntryBinding
import com.filevue.app.util.FileUtils

/**
 * RecyclerView adapter for displaying file/folder entries
 */
class EntryAdapter(
    private val onItemClick: (Entry) -> Unit,
    private val onMoreClick: (Entry, View) -> Unit
) : ListAdapter<Entry, EntryAdapter.EntryViewHolder>(EntryDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): EntryViewHolder {
        val binding = ItemEntryBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return EntryViewHolder(binding)
    }

    override fun onBindViewHolder(holder: EntryViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class EntryViewHolder(
        private val binding: ItemEntryBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(entry: Entry) {
            binding.entryName.text = entry.name

            // Format info line
            val sizeText = if (entry.isDirectory) "Folder" else FileUtils.formatFileSize(entry.size)
            val dateText = FileUtils.formatDate(entry.modified)
            binding.entryInfo.text = "$sizeText • $dateText"

            // Set icon based on file type
            setIcon(entry)

            // Click listeners
            binding.root.setOnClickListener { onItemClick(entry) }
            binding.moreButton.setOnClickListener { onMoreClick(entry, it) }
        }

        private fun setIcon(entry: Entry) {
            val context = binding.root.context
            
            val (iconRes, colorRes) = when {
                entry.isDirectory -> {
                    android.R.drawable.ic_menu_gallery to R.color.folder_color
                }
                FileUtils.isImage(entry.name, entry.mimeType) -> {
                    android.R.drawable.ic_menu_gallery to R.color.image_color
                }
                FileUtils.isTextFile(entry.name, entry.mimeType) -> {
                    android.R.drawable.ic_menu_edit to R.color.text_color
                }
                FileUtils.isVideo(entry.name, entry.mimeType) -> {
                    android.R.drawable.ic_menu_view to R.color.video_color
                }
                FileUtils.isAudio(entry.name, entry.mimeType) -> {
                    android.R.drawable.ic_btn_speak_now to R.color.audio_color
                }
                FileUtils.isPdf(entry.name, entry.mimeType) -> {
                    android.R.drawable.ic_menu_agenda to R.color.pdf_color
                }
                FileUtils.isArchive(entry.name, entry.mimeType) -> {
                    android.R.drawable.ic_menu_save to R.color.archive_color
                }
                else -> {
                    android.R.drawable.ic_menu_help to R.color.file_color
                }
            }

            // Create circular background
            val background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(ContextCompat.getColor(context, colorRes))
            }
            binding.entryIcon.background = background
            binding.entryIcon.setImageResource(iconRes)
            binding.entryIcon.setColorFilter(ContextCompat.getColor(context, R.color.on_primary))
            binding.entryIcon.setPadding(12, 12, 12, 12)
        }
    }

    class EntryDiffCallback : DiffUtil.ItemCallback<Entry>() {
        override fun areItemsTheSame(oldItem: Entry, newItem: Entry): Boolean {
            return oldItem.path == newItem.path
        }

        override fun areContentsTheSame(oldItem: Entry, newItem: Entry): Boolean {
            return oldItem == newItem
        }
    }
}
