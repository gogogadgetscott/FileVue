import { useCallback, useEffect, useRef, useState } from 'react';
import type { Entry } from '../types';
import { formatSize } from '../utils';

interface FileTableProps {
  entries: Entry[];
  readOnly: boolean;
  onOpen: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onShare?: (entry: Entry) => void;
  onFavorite?: (entry: Entry) => void;
  isFavorite?: (path: string) => boolean;
}

const ROW_HEIGHT = 41; // Height of each row in pixels
const OVERSCAN = 5; // Number of extra rows to render above/below viewport

export function FileTable({ entries, readOnly, onOpen, onDelete, onShare, onFavorite, isFavorite }: FileTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Update container height on mount and resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      setContainerHeight(container.clientHeight);
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Calculate visible range
  const totalHeight = entries.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    entries.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN
  );
  const visibleEntries = entries.slice(startIndex, endIndex);
  const offsetY = startIndex * ROW_HEIGHT;

  // For small lists, render normally without virtualization
  const useVirtualization = entries.length > 100;

  if (!useVirtualization) {
    return (
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Modified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.path}>
              <td className="name-cell">
                <button type="button" className="link" onClick={() => onOpen(entry)}>
                  {entry.name}
                </button>
              </td>
              <td>{entry.isDirectory ? 'Folder' : entry.mimeType || 'File'}</td>
              <td>{entry.isDirectory ? '-' : formatSize(entry.size)}</td>
              <td>{new Date(entry.modified).toLocaleString()}</td>
              <td className="actions-cell">
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
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-state">
                Directory is empty.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }

  return (
    <div className="virtual-table-container" ref={containerRef} onScroll={handleScroll}>
      <table className="virtual-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Modified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody style={{ height: totalHeight, position: 'relative' }}>
          <tr style={{ height: offsetY, padding: 0, border: 'none' }}>
            <td colSpan={5} style={{ padding: 0, border: 'none' }}></td>
          </tr>
          {visibleEntries.map((entry) => (
            <tr key={entry.path} style={{ height: ROW_HEIGHT }}>
              <td>
                <button type="button" className="link" onClick={() => onOpen(entry)}>
                  {entry.name}
                </button>
              </td>
              <td>{entry.isDirectory ? 'Folder' : entry.mimeType || 'File'}</td>
              <td>{entry.isDirectory ? '-' : formatSize(entry.size)}</td>
              <td>{new Date(entry.modified).toLocaleString()}</td>
              <td className="actions-cell">
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
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-state">
                Directory is empty.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
