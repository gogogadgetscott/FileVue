import type { Entry, ThumbnailSize } from '../types';
import { formatSize } from '../utils';

interface FileGridProps {
  entries: Entry[];
  thumbnailSize: ThumbnailSize;
  thumbnailCache: Record<string, string>;
  readOnly: boolean;
  onOpen: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onShare?: (entry: Entry) => void;
  onFavorite?: (entry: Entry) => void;
  isFavorite?: (path: string) => boolean;
}

export function FileGrid({
  entries,
  thumbnailSize,
  thumbnailCache,
  readOnly,
  onOpen,
  onDelete,
  onShare,
  onFavorite,
  isFavorite,
}: FileGridProps) {
  return (
    <div className={`card-grid thumbnail thumbnail-${thumbnailSize}`}>
      {entries.map((entry) => {
        const thumbnail = thumbnailCache[entry.path];
        const isImage = Boolean(entry.mimeType && entry.mimeType.startsWith('image/'));
        return (
          <div key={entry.path} className="entry-card">
            <div className="entry-thumb">
              {entry.isDirectory && <div className="thumb-icon">📁</div>}
              {!entry.isDirectory && !isImage && <div className="thumb-icon">📄</div>}
              {!entry.isDirectory && isImage && thumbnail && <img src={thumbnail} alt={entry.name} />}
              {!entry.isDirectory && isImage && thumbnail === undefined && (
                <div className="thumb-icon">⋯</div>
              )}
              {!entry.isDirectory && isImage && thumbnail === '' && <div className="thumb-icon">⚠️</div>}
            </div>
            <div className="entry-body">
              <button type="button" className="link" onClick={() => onOpen(entry)}>
                {entry.name}
              </button>
              <span className="entry-meta">{entry.isDirectory ? 'Folder' : entry.mimeType || 'File'}</span>
              <span className="entry-meta">{entry.isDirectory ? '-' : formatSize(entry.size)}</span>
              <span className="entry-meta">{new Date(entry.modified).toLocaleString()}</span>
              <div className="card-actions">
                {onFavorite && (
                  <button
                    type="button"
                    className={`fav-btn ${isFavorite?.(entry.path) ? 'is-fav' : ''}`}
                    onClick={() => onFavorite(entry)}
                    title={isFavorite?.(entry.path) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {isFavorite?.(entry.path) ? '★' : '☆'}
                  </button>
                )}
                <button type="button" onClick={() => onOpen(entry)}>
                  Open
                </button>
                <button type="button" onClick={() => onDelete(entry)} disabled={readOnly}>
                  Delete
                </button>
                {onShare && (
                  <button type="button" onClick={() => onShare(entry)}>
                    Share
                  </button>
                )}
                {!entry.isDirectory && (
                  <a
                    className="link"
                    href={`/api/file/download?path=${encodeURIComponent(entry.path)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {entries.length === 0 && <div className="empty-state">Directory is empty.</div>}
    </div>
  );
}
