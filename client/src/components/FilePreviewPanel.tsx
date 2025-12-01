import type { FilePreview } from '../types';
import { formatSize } from '../utils';

interface FilePreviewPanelProps {
  preview: FilePreview | null;
}

export function FilePreviewPanel({ preview }: FilePreviewPanelProps) {
  return (
    <div className="preview">
      <div className="explorer-head">
        <span>Preview</span>
      </div>
      <div className="explorer-body">
        {preview ? (
          <div className="preview-content">
            <div className="preview-header">
              <h3>{preview.name}</h3>
              <a
                className="download-btn"
                href={`/api/file/download?path=${encodeURIComponent(preview.path)}`}
                target="_blank"
                rel="noreferrer"
              >
                Download
              </a>
            </div>
            <p>Path: {preview.path}</p>
            <p>Size: {formatSize(preview.size)}</p>
            <p>Modified: {new Date(preview.modified).toLocaleString()}</p>
            {preview.note && <p className="notice">{preview.note}</p>}
            {preview.previewType === 'image' && preview.mimeType && (
              <div className="image-preview">
                <img src={`data:${preview.mimeType};base64,${preview.content}`} alt={preview.name} />
              </div>
            )}
            {preview.previewType === 'text' && (
              <pre>
                <code>{preview.content || '[Empty file]'}</code>
              </pre>
            )}
            {preview.previewType === 'xmp' && (
              <div className="xmp-preview">
                {preview.xmpProperties && preview.xmpProperties.length > 0 ? (
                  <table className="xmp-table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.xmpProperties.map((prop, idx) => (
                        <tr key={idx}>
                          <td title={prop.namespace}>{prop.name}</td>
                          <td>{prop.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <>
                    <p className="empty-state">No XMP properties extracted. Showing raw content:</p>
                    <pre>
                      <code>{preview.content || '[Empty file]'}</code>
                    </pre>
                  </>
                )}
              </div>
            )}
            {preview.previewType === 'binary' && (
              <pre>
                <code>[Binary data shown as base64]</code>
              </pre>
            )}
          </div>
        ) : (
          <div className="empty-state">Select a file to preview its contents.</div>
        )}
      </div>
    </div>
  );
}
