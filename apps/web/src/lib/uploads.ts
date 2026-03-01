import { ensureMaxDataUrlSize } from '@/lib/imageTools';
import { QueueItem } from '@/lib/types';

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const fileName = decodeURIComponent(parsed.pathname.split('/').pop() || '');
    return fileName || `image-${Date.now()}.jpg`;
  } catch {
    return `image-${Date.now()}.jpg`;
  }
}

function guessMimeFromFileName(fileName: string): string {
  const clean = fileName.toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.avif')) return 'image/avif';
  if (clean.endsWith('.bmp')) return 'image/bmp';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export async function filesToQueueItems(files: FileList | File[]): Promise<QueueItem[]> {
  const list = Array.from(files as File[]);
  const items: QueueItem[] = [];

  for (const file of list) {
    const rawDataUrl = await fileToDataUrl(file);
    const dataUrl = await ensureMaxDataUrlSize(rawDataUrl);
    items.push({
      id: makeId(),
      source: 'upload',
      name: file.name,
      size: file.size || 0,
      type: file.type || 'image/jpeg',
      dataUrl,
      status: 'ready',
      altText: '',
    });
  }

  return items;
}

export function createUrlQueueItem(imageUrl: string): QueueItem {
  const normalized = new URL(imageUrl).toString();
  const name = deriveNameFromUrl(normalized);

  return {
    id: makeId(),
    source: 'url',
    name,
    size: 0,
    type: guessMimeFromFileName(name),
    imageUrl: normalized,
    status: 'ready',
    altText: '',
  };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
