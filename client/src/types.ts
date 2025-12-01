export interface Entry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: number;
  mimeType: string | null;
}

export interface XmpProperty {
  namespace: string;
  name: string;
  value: string;
}

export interface FilePreview {
  name: string;
  path: string;
  size: number;
  modified: number;
  encoding: string;
  content: string;
  mimeType?: string | null;
  previewType: 'text' | 'image' | 'binary' | 'xmp';
  note?: string;
  xmpProperties?: XmpProperty[];
}

export interface ExplorerMeta {
  version: string;
  rootDirectory: string;
  readOnly: boolean;
  maxPreviewBytes: number;
  imagePreviewMaxBytes: number;
  thumbnailMaxBytes: number;
}

export interface AuthStatus {
  authRequired: boolean;
  authenticated?: boolean;
  sessionTtlSeconds: number;
}

export interface ThumbnailPayload {
  path: string;
  mimeType: string;
  encoding: 'base64';
  content: string;
}

export type ViewMode = 'table' | 'thumbnail' | 'tree' | 'favorites';

export type ThumbnailSize = 'small' | 'medium' | 'large';

export interface Credentials {
  username: string;
  password: string;
}

export const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'thumbnail', label: 'Thumbnails' },
  { value: 'tree', label: 'Tree' },
  { value: 'favorites', label: '★ Favorites' },
];

export const THUMBNAIL_SIZES: { value: ThumbnailSize; label: string }[] = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' },
];

export interface SearchResult {
  query: string;
  path: string;
  results: Entry[];
  resultCount: number;
  truncated: boolean;
  timedOut: boolean;
  durationMs: number;
}

export interface ShareInfo {
  shareId: string;
  accessCode: string;
  shareUrl: string;
  expiresAt: number;
  expiresIn: string;
  name: string;
  isDirectory: boolean;
}

export interface ShareAccess {
  valid: boolean;
  accessToken: string;
  name: string;
  isDirectory: boolean;
  expiresAt: number;
}

export interface SharedContent {
  type: 'file' | 'directory';
  name: string;
  path: string;
  entries?: Entry[];
  size?: number;
  mimeType?: string;
  previewType?: 'text' | 'image' | 'binary' | 'too-large';
  encoding?: string;
  content?: string;
  note?: string;
}

export interface ActiveShare {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
}
