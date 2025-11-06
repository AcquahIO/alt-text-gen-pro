export type ItemStatus = 'idle' | 'ready' | 'generating' | 'done' | 'error';

export interface PendingUploadEntry {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface StoredPendingUploads {
  entries: PendingUploadEntry[];
  language?: string;
  context?: string;
  when?: number;
}

export interface UploadItem extends PendingUploadEntry {
  id: string;
  status: ItemStatus;
  altText: string;
  error?: string;
  generatedAt?: number;
  file?: File;
}

export interface RecentAltItem {
  srcUrl: string;
  altText: string;
  pageTitle?: string;
  when?: number;
}
