import { useState, useEffect, useCallback } from 'react';
import type { SharedContent, Entry } from '../types';
import { formatSize } from '../utils';

interface SharedViewProps {
  shareId: string;
}

export function SharedView({ shareId }: SharedViewProps) {
  const [accessCode, setAccessCode] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [shareName, setShareName] = useState<string | null>(null);
  const [isDirectory, setIsDirectory] = useState(false);
  const [content, setContent] = useState<SharedContent | null>(null);
  const [currentPath, setCurrentPath] = useState('.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const verifyAccess = async () => {
    if (!accessCode.trim()) {
      setError('Please enter the access code');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/shares/${shareId}/verify?code=${encodeURIComponent(accessCode.trim())}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setAccessToken(data.accessToken);
      setShareName(data.name);
      setIsDirectory(data.isDirectory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const fetchContent = useCallback(async (path: string) => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/shares/${shareId}/content?path=${encodeURIComponent(path)}`,
        {
          headers: {
            'X-Share-Token': accessToken,
          },
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load content');
      }

      setContent(data);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [shareId, accessToken]);

  useEffect(() => {
    if (accessToken) {
      fetchContent('.');
    }
  }, [accessToken, fetchContent]);

  const handleDownload = (filePath?: string) => {
    if (!accessToken) return;
    const downloadPath = filePath || currentPath;
    const url = `/api/shares/${shareId}/download?path=${encodeURIComponent(downloadPath)}`;
    
    // Create a form to POST with the token
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    
    // We need to add the token - use a hidden iframe approach or fetch blob
    fetch(url, {
      headers: { 'X-Share-Token': accessToken },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      })
      .catch((err) => setError(err.message));
  };

  const navigateTo = (entry: Entry) => {
    if (entry.isDirectory) {
      fetchContent(entry.path);
    } else {
      fetchContent(entry.path);
    }
  };

  const goUp = () => {
    if (currentPath === '.' || currentPath === '') return;
    const parts = currentPath.split('/');
    parts.pop();
    fetchContent(parts.length ? parts.join('/') : '.');
  };

  // Access code entry screen
  if (!accessToken) {
    return (
      <div className="shared-view">
        <div className="shared-access-form">
          <h2>🔗 Shared Content</h2>
          <p>Enter the access code to view this shared content.</p>
          
          <div className="form-group">
            <label htmlFor="accessCode">Access Code:</label>
            <input
              id="accessCode"
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-character code"
              maxLength={6}
              className="access-code-input"
              onKeyDown={(e) => e.key === 'Enter' && verifyAccess()}
              autoFocus
            />
          </div>

          {error && <div className="notice error">{error}</div>}

          <button type="button" onClick={verifyAccess} disabled={verifying}>
            {verifying ? 'Verifying...' : 'Access Content'}
          </button>
        </div>
      </div>
    );
  }

  // Content view
  return (
    <div className="shared-view">
      <header className="shared-header">
        <h2>🔗 {shareName}</h2>
        <span className="shared-badge">{isDirectory ? 'Shared Folder' : 'Shared File'}</span>
      </header>

      {isDirectory && currentPath !== '.' && (
        <div className="shared-nav">
          <button type="button" onClick={goUp}>⬆ Up</button>
          <span className="shared-path">/{currentPath}</span>
        </div>
      )}

      {error && <div className="notice error">{error}</div>}
      {loading && <div className="notice">Loading...</div>}

      {content && content.type === 'directory' && (
        <div className="shared-listing">
          {content.entries?.map((entry) => (
            <div
              key={entry.path}
              className="shared-entry"
              onClick={() => navigateTo(entry)}
            >
              <span className="entry-icon">{entry.isDirectory ? '📁' : '📄'}</span>
              <span className="entry-name">{entry.name}</span>
              <span className="entry-size">{entry.isDirectory ? '' : formatSize(entry.size)}</span>
              {!entry.isDirectory && (
                <button
                  type="button"
                  className="download-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(entry.path);
                  }}
                >
                  Download
                </button>
              )}
            </div>
          ))}
          {content.entries?.length === 0 && (
            <div className="empty-state">This folder is empty.</div>
          )}
        </div>
      )}

      {content && content.type === 'file' && (
        <div className="shared-file-preview">
          <div className="file-info">
            <h3>{content.name}</h3>
            <p>Size: {formatSize(content.size || 0)}</p>
            <button type="button" onClick={() => handleDownload()}>
              Download File
            </button>
          </div>

          {content.previewType === 'image' && content.content && (
            <div className="image-preview">
              <img
                src={`data:${content.mimeType};base64,${content.content}`}
                alt={content.name}
              />
            </div>
          )}

          {content.previewType === 'text' && content.content && (
            <pre className="text-preview">
              <code>{content.content}</code>
            </pre>
          )}

          {content.previewType === 'binary' && (
            <div className="binary-notice">
              <p>Binary file. Use the download button to get the file.</p>
            </div>
          )}

          {content.previewType === 'too-large' && (
            <div className="binary-notice">
              <p>{content.note || 'File too large for preview. Use the download button.'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
