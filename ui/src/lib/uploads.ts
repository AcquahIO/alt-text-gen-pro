import { ensureMaxDataUrlSize } from '@extension/utils/imageTools.js';
import { PendingUploadEntry, UploadItem } from './types';

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function fileToDataUrl(file: File, onProgress?: (progress: ProgressEvent<FileReader>) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    if (onProgress) reader.onprogress = onProgress;
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = String(dataUrl).split(',')[1] || '';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function filesToPendingEntries(files: FileList | File[]): Promise<PendingUploadEntry[]> {
  const list = Array.from(files as File[]);
  const results: PendingUploadEntry[] = [];
  for (const file of list) {
    const rawDataUrl = await fileToDataUrl(file);
    const dataUrl = await ensureMaxDataUrlSize(rawDataUrl).catch(() => rawDataUrl);
    results.push({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size || 0,
      dataUrl,
    });
  }
  return results;
}

export async function filesToUploadItems(files: FileList | File[]): Promise<UploadItem[]> {
  const list = Array.from(files as File[]);
  const entries = await filesToPendingEntries(list);
  return entries.map((entry, idx) => ({
    ...entry,
    id: makeId(),
    status: 'ready',
    altText: '',
    file: list[idx],
  }));
}

export function entriesToItems(entries: PendingUploadEntry[], options: { existing?: UploadItem[] } = {}): UploadItem[] {
  const out: UploadItem[] = [];
  const existing = options.existing || [];
  for (const entry of entries) {
    const match = existing.find((it) => it.dataUrl === entry.dataUrl && it.name === entry.name && it.size === entry.size);
    if (match) {
      out.push(match);
      continue;
    }
    out.push({
      ...entry,
      id: makeId(),
      status: 'ready',
      altText: '',
    });
  }
  return out;
}

export function mergeItems(current: UploadItem[], next: UploadItem[]): UploadItem[] {
  const map = new Map<string, UploadItem>();
  for (const item of current) map.set(item.id, item);
  for (const item of next) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}
