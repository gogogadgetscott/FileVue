import type { Entry } from '../types';
import type { Favorite } from '../hooks/useFavorites';
import { formatSize } from '../utils';

interface FavoritesViewProps {
  favorites: Favorite[];
  onOpen: (entry: Entry) => void;
  onRemove: (path: string) => void;
  onClear: () => void;
}

export function FavoritesView({ favorites, onOpen, onRemove, onClear }: FavoritesViewProps) {
  // Convert favorites to Entry-like objects for navigation
  const handleOpen = (fav: Favorite) => {
    const entry: Entry = {
      name: fav.name,
      path: fav.path,
      isDirectory: fav.isDirectory,
      size: 0,
      modified: fav.addedAt,
      mimeType: null,
    };
    onOpen(entry);
  };

  if (favorites.length === 0) {
    return (
      <div className="favorites-empty">
        <div className="empty-icon">⭐</div>
        <h3>No Favorites Yet</h3>
        <p>Click the star icon on any file or folder to add it to your favorites.</p>
      </div>
    );
  }

  return (
    <div className="favorites-view">
      <div className="favorites-header">
        <span className="favorites-count">{favorites.length} favorite{favorites.length !== 1 ? 's' : ''}</span>
        <button type="button" className="clear-btn" onClick={onClear}>
          Clear All
        </button>
      </div>
      <div className="favorites-list">
        {favorites.map((fav) => (
          <div key={fav.path} className="favorite-item">
            <span className="fav-icon">{fav.isDirectory ? '📁' : '📄'}</span>
            <div className="fav-info">
              <button type="button" className="link fav-name" onClick={() => handleOpen(fav)}>
                {fav.name}
              </button>
              <span className="fav-path">{fav.path}</span>
            </div>
            <span className="fav-added">
              Added {new Date(fav.addedAt).toLocaleDateString()}
            </span>
            <button
              type="button"
              className="remove-fav-btn"
              onClick={() => onRemove(fav.path)}
              title="Remove from favorites"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
