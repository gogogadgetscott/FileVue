import { useState } from 'react';
import type { Entry, ShareInfo } from '../types';

interface ShareDialogProps {
  entry: Entry;
  shareInfo: ShareInfo | null;
  onCreateShare: (path: string, isDirectory: boolean, durationHours: number) => Promise<void>;
  onClose: () => void;
}

export function ShareDialog({ entry, shareInfo, onCreateShare, onClose }: ShareDialogProps) {
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'url' | 'code' | null>(null);

  const handleShare = async () => {
    setLoading(true);
    setError(null);
    try {
      await onCreateShare(entry.path, entry.isDirectory, expiresInHours);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'url' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const fullShareUrl = shareInfo ? `${window.location.origin}${shareInfo.shareUrl}` : '';

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog share-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Share {entry.isDirectory ? 'Folder' : 'File'}</h3>
          <button type="button" className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="dialog-body">
          <p className="share-target">
            <strong>{entry.name}</strong>
            <span className="share-path">{entry.path}</span>
          </p>

          {!shareInfo ? (
            <>
              <div className="form-group">
                <label htmlFor="expiry">Link expires in:</label>
                <select
                  id="expiry"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                >
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>2 days</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </div>

              {error && <div className="notice error">{error}</div>}

              <div className="dialog-actions">
                <button type="button" onClick={onClose}>Cancel</button>
                <button type="button" onClick={handleShare} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Share Link'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="share-result">
                <div className="share-field">
                  <label>Share URL:</label>
                  <div className="share-value-row">
                    <input type="text" value={fullShareUrl} readOnly />
                    <button 
                      type="button" 
                      onClick={() => copyToClipboard(fullShareUrl, 'url')}
                      className={copied === 'url' ? 'copied' : ''}
                    >
                      {copied === 'url' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="share-field">
                  <label>Access Code:</label>
                  <div className="share-value-row">
                    <input 
                      type="text" 
                      value={shareInfo.accessCode} 
                      readOnly 
                      className="access-code"
                    />
                    <button 
                      type="button" 
                      onClick={() => copyToClipboard(shareInfo.accessCode, 'code')}
                      className={copied === 'code' ? 'copied' : ''}
                    >
                      {copied === 'code' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <p className="share-note">
                  Share both the URL and access code with the recipient. 
                  The link expires in {shareInfo.expiresIn}.
                </p>
              </div>

              <div className="dialog-actions">
                <button type="button" onClick={onClose}>Done</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
