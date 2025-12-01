import type { ReactNode } from 'react';
import type { Entry } from '../types';
import { formatSize } from '../utils';

interface FileTreeProps {
  treeData: Record<string, Entry[]>;
  expandedPaths: Set<string>;
  currentPath: string;
  rootDirectory: string;
  onToggle: (entry: Entry) => void;
  onSelect: (entry: Entry) => void;
}

export function FileTree({
  treeData,
  expandedPaths,
  currentPath,
  rootDirectory,
  onToggle,
  onSelect,
}: FileTreeProps) {
  const rootTreeEntries = treeData['.'];

  const renderBranch = (parentPath: string, depth = 0): ReactNode => {
    const nodes = treeData[parentPath] || [];
    if (!nodes.length) {
      return null;
    }
    return nodes.map((entry) => {
      const isExpanded = expandedPaths.has(entry.path);
      const isDir = entry.isDirectory;
      return (
        <div key={entry.path} className={`tree-row ${currentPath === entry.path ? 'active' : ''}`}>
          <div className="tree-row-inner" style={{ paddingLeft: depth * 20 }}>
            {isDir ? (
              <button type="button" className="tree-toggle" onClick={() => onToggle(entry)}>
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="tree-toggle placeholder" />
            )}
            <button type="button" className="tree-label" onClick={() => onSelect(entry)}>
              {entry.name}
            </button>
            <span className="tree-meta">{isDir ? '[DIR]' : formatSize(entry.size)}</span>
            {!isDir && (
              <a
                className="tree-download"
                href={`/api/file/download?path=${encodeURIComponent(entry.path)}`}
                target="_blank"
                rel="noreferrer"
                title="Download"
              >
                ⬇
              </a>
            )}
          </div>
          {isDir && isExpanded && renderBranch(entry.path, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="tree-view">
      <div className="tree-root">{rootDirectory || 'root'}</div>
      <div className="tree-branch">
        {rootTreeEntries ? (
          rootTreeEntries.length ? (
            renderBranch('.')
          ) : (
            <div className="empty-state">Directory is empty.</div>
          )
        ) : (
          <div className="empty-state">Loading tree...</div>
        )}
      </div>
    </div>
  );
}
