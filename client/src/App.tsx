import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { LoginForm, FilePreviewPanel, FileTree, FileTable, FileGrid, ShareDialog, SharedView, FavoritesView } from './components';
import { useFavorites } from './hooks';
import {
  type Entry,
  type FilePreview,
  type ExplorerMeta,
  type AuthStatus,
  type ThumbnailPayload,
  type ViewMode,
  type ThumbnailSize,
  type Credentials,
  type SearchResult,
  type ShareInfo,
  VIEW_MODES,
  THUMBNAIL_SIZES,
} from './types';
import { formatSize, deriveBreadcrumbs } from './utils';

function App() {
  // Check if we're on a share URL
  const isShareUrl = window.location.pathname.startsWith('/share/');
  const shareIdFromUrl = isShareUrl ? window.location.pathname.split('/')[2] : null;

  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [meta, setMeta] = useState<ExplorerMeta | null>(null);
  const [currentPath, setCurrentPath] = useState('.');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [thumbnailSize, setThumbnailSize] = useState<ThumbnailSize>('medium');
  const [thumbnailCache, setThumbnailCache] = useState<Record<string, string>>({});
  const thumbnailCacheRef = useRef<Record<string, string>>({});
  const thumbnailRequests = useRef<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<Record<string, Entry[]>>({});
  const treeDataRef = useRef<Record<string, Entry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['.']));
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [shareDialogEntry, setShareDialogEntry] = useState<Entry | null>(null);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);

  // Favorites
  const { favorites, toggleFavorite, removeFavorite, isFavorite, clearFavorites } = useFavorites();

  useEffect(() => {
    thumbnailCacheRef.current = thumbnailCache;
  }, [thumbnailCache]);

  useEffect(() => {
    treeDataRef.current = treeData;
  }, [treeData]);

  // Get CSRF token from cookie
  const getCsrfToken = useCallback(() => {
    const match = document.cookie.match(/(?:^|;\s*)explorer_csrf=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, []);

  const requestAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/status', { credentials: 'include' });
      const status = (await response.json()) as AuthStatus;
      setAuthStatus(status);
    } catch {
      setAuthStatus({ authRequired: false, authenticated: true, sessionTtlSeconds: 0 });
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore logout network error
    }
    setEntries([]);
    setPreview(null);
    setMeta(null);
    setError(null);
    setThumbnailCache({});
    thumbnailCacheRef.current = {};
    thumbnailRequests.current.clear();
    setTreeData({});
    treeDataRef.current = {};
    setExpandedPaths(new Set(['.']));
    setAuthStatus((prev) =>
      prev ? { ...prev, authenticated: false } : { authRequired: true, authenticated: false, sessionTtlSeconds: 0 }
    );
    await requestAuthStatus();
  }, [requestAuthStatus]);

  const apiRequest = useCallback(
    async <T,>(input: RequestInfo, init?: RequestInit): Promise<T> => {
      const headers = new Headers(init?.headers || {});
      // Add CSRF token for state-changing requests
      const method = init?.method?.toUpperCase();
      if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers.set('X-CSRF-Token', csrfToken);
        }
      }
      const response = await fetch(input, { ...init, headers, credentials: 'include' });
      if (!response.ok) {
        if (response.status === 401) {
          await handleLogout();
        }
        let message = response.statusText;
        try {
          const data = await response.json();
          if (data.error) message = data.error;
        } catch {
          // Ignore parse failure
        }
        throw new Error(message);
      }
      return response.json() as Promise<T>;
    },
    [getCsrfToken, handleLogout]
  );

  useEffect(() => {
    requestAuthStatus();
  }, [requestAuthStatus]);

  useEffect(() => {
    if (!authStatus || (authStatus.authRequired && !authStatus.authenticated)) return;
    apiRequest<ExplorerMeta>('/api/meta')
      .then(setMeta)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [apiRequest, authStatus]);

  useEffect(() => {
    if (!authStatus || (authStatus.authRequired && !authStatus.authenticated)) return;
    setLoading(true);
    setError(null);
    apiRequest<{ path: string; entries: Entry[] }>(`/api/tree?path=${encodeURIComponent(currentPath)}`)
      .then((payload) => {
        setEntries(payload.entries);
        const normalizedPath = payload.path || '.';
        setCurrentPath((prev) => (prev === normalizedPath ? prev : normalizedPath));
        setTreeData((prev) => ({ ...prev, [normalizedPath]: payload.entries }));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [apiRequest, authStatus, currentPath, reloadKey]);

  const ensureTreeData = useCallback(
    async (targetPath: string) => {
      if (treeDataRef.current[targetPath]) return;
      try {
        const payload = await apiRequest<{ path: string; entries: Entry[] }>(
          `/api/tree?path=${encodeURIComponent(targetPath)}`
        );
        const normalizedPath = payload.path || targetPath;
        setTreeData((prev) => ({ ...prev, [normalizedPath]: payload.entries }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [apiRequest]
  );

  useEffect(() => {
    if (!authStatus || (authStatus.authRequired && !authStatus.authenticated)) return;
    ensureTreeData('.');
  }, [authStatus, ensureTreeData]);

  const breadcrumbs = useMemo(() => deriveBreadcrumbs(currentPath), [currentPath]);

  const handleEnter = useCallback(
    (entry: Entry) => {
      if (entry.isDirectory) {
        setCurrentPath(entry.path);
        setPreview(null);
      } else {
        setPreview(null);
        apiRequest<FilePreview>(`/api/file/content?path=${encodeURIComponent(entry.path)}`)
          .then(setPreview)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
      }
    },
    [apiRequest]
  );

  const goUp = () => {
    if (currentPath === '.' || currentPath.length === 0) return;
    const segments = breadcrumbs.slice(0, -1);
    setCurrentPath(segments.length ? segments.join('/') : '.');
    setPreview(null);
  };

  const refresh = () => {
    setReloadKey((key) => key + 1);
  };

  const toggleDirectoryNode = useCallback(
    async (entry: Entry) => {
      if (!entry.isDirectory) {
        handleEnter(entry);
        return;
      }
      const isExpanded = expandedPaths.has(entry.path);
      if (!isExpanded) {
        await ensureTreeData(entry.path);
      }
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (isExpanded) {
          next.delete(entry.path);
        } else {
          next.add(entry.path);
        }
        return next;
      });
    },
    [ensureTreeData, expandedPaths, handleEnter]
  );

  const handleCreateFolder = async () => {
    if (meta?.readOnly) return;
    const name = window.prompt('Folder name');
    if (!name) return;
    try {
      await apiRequest('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath: currentPath, name }),
      });
      refresh();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  };

  const handleCreateFile = async () => {
    if (meta?.readOnly) return;
    const name = window.prompt('File name (include extension)');
    if (!name) return;
    const content = window.prompt('File content');
    if (content === null) return;
    try {
      await apiRequest('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath: currentPath, name, content, encoding: 'utf-8' }),
      });
      refresh();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  };

  const handleDelete = useCallback(
    async (entry: Entry) => {
      if (meta?.readOnly) return;
      const confirmMessage = entry.isDirectory
        ? `Delete directory "${entry.name}" and its contents?`
        : `Delete file "${entry.name}"?`;
      if (!window.confirm(confirmMessage)) return;
      try {
        await apiRequest(`/api/entries?path=${encodeURIComponent(entry.path)}`, { method: 'DELETE' });
        refresh();
        if (preview?.path === entry.path) {
          setPreview(null);
        }
      } catch (err) {
        if (err instanceof Error) setError(err.message);
      }
    },
    [apiRequest, meta?.readOnly, preview?.path]
  );

  const handleUploadClick = () => {
    if (meta?.readOnly) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('parentPath', currentPath);
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      const headers: HeadersInit = {};
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }
      refresh();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setError('Search query must be at least 2 characters');
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const result = await apiRequest<SearchResult>(
        `/api/search?q=${encodeURIComponent(searchQuery.trim())}&path=${encodeURIComponent(currentPath)}`
      );
      setSearchResults(result);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const handleShare = useCallback((entry: Entry) => {
    setShareDialogEntry(entry);
    setShareInfo(null);
  }, []);

  const handleCreateShare = useCallback(async (path: string, isDirectory: boolean, durationHours: number) => {
    try {
      const result = await apiRequest<ShareInfo>('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, isDirectory, durationHours }),
      });
      setShareInfo(result);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  }, [apiRequest]);

  const handleCloseShareDialog = useCallback(() => {
    setShareDialogEntry(null);
    setShareInfo(null);
  }, []);

  const handleFavorite = useCallback((entry: Entry) => {
    toggleFavorite(entry.path, entry.name, entry.isDirectory);
  }, [toggleFavorite]);

  const handleFavoriteOpen = useCallback((entry: Entry) => {
    // Navigate to the favorite item
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
      setViewMode('tree');
      setPreview(null);
    } else {
      // For files, navigate to parent and then open file
      const parts = entry.path.split('/');
      parts.pop();
      const parentPath = parts.length ? parts.join('/') : '.';
      setCurrentPath(parentPath);
      setViewMode('table');
      // Fetch file preview
      apiRequest<FilePreview>(`/api/file/content?path=${encodeURIComponent(entry.path)}`)
        .then(setPreview)
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    }
  }, [apiRequest]);

  const handleClearFavorites = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all favorites?')) {
      clearFavorites();
    }
  }, [clearFavorites]);

  const queueThumbnail = useCallback(
    (entry: Entry) => {
      if (!entry.mimeType || !entry.mimeType.startsWith('image/')) return;
      if (thumbnailCacheRef.current[entry.path] !== undefined) return;
      if (thumbnailRequests.current.has(entry.path)) return;
      thumbnailRequests.current.add(entry.path);
      apiRequest<ThumbnailPayload>(`/api/file/thumbnail?path=${encodeURIComponent(entry.path)}`)
        .then((payload) => {
          const dataUrl = `data:${payload.mimeType};base64,${payload.content}`;
          setThumbnailCache((prev) => ({ ...prev, [entry.path]: dataUrl }));
        })
        .catch(() => {
          setThumbnailCache((prev) => ({ ...prev, [entry.path]: '' }));
        })
        .finally(() => {
          thumbnailRequests.current.delete(entry.path);
        });
    },
    [apiRequest]
  );

  useEffect(() => {
    if (viewMode === 'table') return;
    entries.forEach((entry) => queueThumbnail(entry));
  }, [entries, queueThumbnail, viewMode]);

  const authRequired = authStatus?.authRequired ?? false;
  const shouldShowLogin = authRequired && !authStatus?.authenticated;

  const handleLogin = async (credentials: Credentials) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include',
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to log in');
    }
    setAuthStatus((prev) =>
      prev
        ? { ...prev, authenticated: true }
        : { authRequired: true, authenticated: true, sessionTtlSeconds: payload.expiresIn ?? 0 }
    );
    await requestAuthStatus();
  };

  // If accessing a share URL, show SharedView (no auth required)
  if (isShareUrl && shareIdFromUrl) {
    return <SharedView shareId={shareIdFromUrl} />;
  }

  if (!authStatus) {
    return <div className="app-shell">Initializing...</div>;
  }

  if (shouldShowLogin) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>FileVue</h1>
          <p className="subtitle">Browse and audit an existing folder directly from your browser.</p>
        </div>
        <div className="status-block">
          {authRequired && authStatus?.authenticated && (
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </header>

      <section className="toolbar">
        <div>
          <button type="button" onClick={goUp} disabled={currentPath === '.'}>
            Up
          </button>
          <button type="button" onClick={refresh}>
            Refresh
          </button>
        </div>
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" disabled={searching || searchQuery.trim().length < 2}>
            {searching ? '...' : 'Search'}
          </button>
          {searchResults && (
            <button type="button" onClick={clearSearch}>
              Clear
            </button>
          )}
        </form>
        <div>
          <button type="button" onClick={handleCreateFolder} disabled={!!meta?.readOnly}>
            New Folder
          </button>
          <button type="button" onClick={handleCreateFile} disabled={!!meta?.readOnly}>
            New File
          </button>
          <button type="button" onClick={handleUploadClick} disabled={!!meta?.readOnly || uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            style={{ display: 'none' }}
          />
        </div>
        <div className="view-toggle">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={viewMode === mode.value ? 'active' : ''}
              onClick={() => setViewMode(mode.value)}
            >
              {mode.label}
            </button>
          ))}
          {viewMode === 'thumbnail' && (
            <span className="size-toggle">
              {THUMBNAIL_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  className={thumbnailSize === size.value ? 'active' : ''}
                  onClick={() => setThumbnailSize(size.value)}
                >
                  {size.label}
                </button>
              ))}
            </span>
          )}
        </div>
      </section>

      <section className="breadcrumbs">
        <span className="crumb clickable" onClick={() => setCurrentPath('.')}>
          root
        </span>
        {breadcrumbs.map((segment, index) => {
          const pathUpToHere = breadcrumbs.slice(0, index + 1).join('/');
          return (
            <span key={segment}>
              <span className="crumb-separator">/</span>
              <span className="crumb clickable" onClick={() => setCurrentPath(pathUpToHere)}>
                {segment}
              </span>
            </span>
          );
        })}
      </section>

      {error && <div className="notice error">{error}</div>}
      {loading && <div className="notice">Loading...</div>}

      <section className="workspace">
        <div className="explorer">
          <div className="explorer-head">
            {searchResults ? (
              <span>
                Search: "{searchResults.query}" — {searchResults.resultCount} result{searchResults.resultCount !== 1 ? 's' : ''}
                {searchResults.truncated && ' (truncated)'}
                {searchResults.timedOut && ' (timed out)'}
                {' '}in {searchResults.durationMs}ms
              </span>
            ) : viewMode === 'favorites' ? (
              <span>★ Favorites ({favorites.length})</span>
            ) : (
              <span>{viewMode === 'tree' ? 'Directory Tree' : `Entries (${entries.length})`}</span>
            )}
          </div>
          <div className="explorer-body">
            {searchResults ? (
              <FileTable
                entries={searchResults.results}
                readOnly={!!meta?.readOnly}
                onOpen={handleEnter}
                onDelete={handleDelete}
                onShare={handleShare}
                onFavorite={handleFavorite}
                isFavorite={isFavorite}
              />
            ) : viewMode === 'favorites' ? (
              <FavoritesView
                favorites={favorites}
                onOpen={handleFavoriteOpen}
                onRemove={removeFavorite}
                onClear={handleClearFavorites}
              />
            ) : viewMode === 'tree' ? (
              <FileTree
                treeData={treeData}
                expandedPaths={expandedPaths}
                currentPath={currentPath}
                rootDirectory={meta?.rootDirectory || 'root'}
                onToggle={toggleDirectoryNode}
                onSelect={handleEnter}
              />
            ) : viewMode === 'table' ? (
              <FileTable
                entries={entries}
                readOnly={!!meta?.readOnly}
                onOpen={handleEnter}
                onDelete={handleDelete}
                onShare={handleShare}
                onFavorite={handleFavorite}
                isFavorite={isFavorite}
              />
            ) : (
              <FileGrid
                entries={entries}
                thumbnailSize={thumbnailSize}
                thumbnailCache={thumbnailCache}
                readOnly={!!meta?.readOnly}
                onOpen={handleEnter}
                onDelete={handleDelete}
                onShare={handleShare}
                onFavorite={handleFavorite}
                isFavorite={isFavorite}
              />
            )}
          </div>
        </div>
        <FilePreviewPanel preview={preview} />
      </section>

      <footer className="app-footer">
        {meta && (
          <div className="footer-status">
            <span className="badge">Root: {meta.rootDirectory}</span>
            <span className={`badge ${meta.readOnly ? 'read-only' : 'read-write'}`}>
              Mode: {meta.readOnly ? 'Read-only' : 'Read/Write'}
            </span>
            <span className="badge subtle">Preview ≤ {formatSize(meta.maxPreviewBytes)}</span>
          </div>
        )}
        <div className="footer-info">
          <span>FileVue {meta?.version && `v${meta.version}`}</span>
        </div>
      </footer>

      {shareDialogEntry && (
        <ShareDialog
          entry={shareDialogEntry}
          shareInfo={shareInfo}
          onCreateShare={handleCreateShare}
          onClose={handleCloseShareDialog}
        />
      )}
    </div>
  );
}

export default App;
