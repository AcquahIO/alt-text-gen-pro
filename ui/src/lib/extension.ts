import { embedAltTextIntoImage } from '@extension/utils/metadata.js';
import { PendingUploadEntry, StoredPendingUploads, UploadItem, RecentAltItem } from './types';
import { dataUrlToArrayBuffer } from './uploads';

const chromeApi = typeof chrome !== 'undefined' ? chrome : undefined;

export const isExtensionEnvironment = Boolean(chromeApi?.runtime?.id);

type LocalDefaults<T> = Partial<T> | undefined;

export async function getLocal<T extends Record<string, unknown>>(defaults: LocalDefaults<T> = undefined): Promise<T> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    return chromeApi.storage.local.get(defaults ?? {}) as Promise<T>;
  }
  const result: Record<string, unknown> = { ...(defaults ?? {}) };
  if (!defaults) return result as T;
  for (const key of Object.keys(defaults)) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
  }
  return result as T;
}

export async function setLocal(values: Record<string, unknown>): Promise<void> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    await chromeApi.storage.local.set(values);
    return;
  }
  Object.entries(values).forEach(([key, value]) => {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  });
}

export async function removeLocal(keys: string[]): Promise<void> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    await chromeApi.storage.local.remove(keys);
    return;
  }
  keys.forEach((key) => {
    localStorage.removeItem(key);
  });
}

export async function getSync<T extends Record<string, unknown>>(defaults: LocalDefaults<T> = undefined): Promise<T> {
  if (isExtensionEnvironment && chromeApi?.storage?.sync) {
    return chromeApi.storage.sync.get(defaults ?? {}) as Promise<T>;
  }
  const result: Record<string, unknown> = { ...(defaults ?? {}) };
  if (!defaults) return result as T;
  for (const key of Object.keys(defaults)) {
    const value = localStorage.getItem(`sync:${key}`);
    if (value !== null) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
  }
  return result as T;
}

export async function setSync(values: Record<string, unknown>): Promise<void> {
  if (isExtensionEnvironment && chromeApi?.storage?.sync) {
    await chromeApi.storage.sync.set(values);
    return;
  }
  Object.entries(values).forEach(([key, value]) => {
    localStorage.setItem(`sync:${key}`, typeof value === 'string' ? value : JSON.stringify(value));
  });
}

export async function removeSync(keys: string[]): Promise<void> {
  if (isExtensionEnvironment && chromeApi?.storage?.sync) {
    await chromeApi.storage.sync.remove(keys);
    return;
  }
  keys.forEach((key) => {
    localStorage.removeItem(`sync:${key}`);
  });
}

export function getRuntimeUrl(path: string): string {
  if (isExtensionEnvironment) {
    try {
      return chromeApi!.runtime.getURL(path);
    } catch (e) {
      console.warn('chrome.runtime.getURL failed', e);
    }
  }
  return path;
}

export async function openFullPageView(): Promise<void> {
  const url = getRuntimeUrl('ui-dist/fullpage.html');
  if (isExtensionEnvironment && chromeApi?.tabs?.create) {
    await new Promise<void>((resolve) => {
      chromeApi.tabs.create({ url }, () => resolve());
    });
  } else {
    window.open(url, '_blank');
  }
}

export async function storePendingUploads(entries: PendingUploadEntry[], extras: { language?: string; context?: string } = {}): Promise<void> {
  if (!entries.length) return;
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    await chromeApi.storage.local.set({
      pendingUploads: {
        when: Date.now(),
        entries,
        language: extras.language,
        context: extras.context,
      },
    });
    return;
  }
  try {
    const payload: StoredPendingUploads = {
      entries,
      language: extras.language,
      context: extras.context,
      when: Date.now(),
    };
    localStorage.setItem('pendingUploads', JSON.stringify(payload));
  } catch (e) {
    console.warn('Fallback pending upload store failed', e);
  }
}

export async function consumePendingUploads(): Promise<StoredPendingUploads | null> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    const result = await chromeApi.storage.local.get('pendingUploads');
    const pending = result.pendingUploads as StoredPendingUploads | undefined;
    if (pending) {
      await chromeApi.storage.local.remove('pendingUploads');
      return pending;
    }
    return null;
  }
  try {
    const raw = localStorage.getItem('pendingUploads');
    if (!raw) return null;
    localStorage.removeItem('pendingUploads');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Fallback pending upload consume failed', e);
    return null;
  }
}

export async function getPreferredLanguage(): Promise<string> {
  if (isExtensionEnvironment && chromeApi?.storage?.sync) {
    const result = await chromeApi.storage.sync.get({ preferredLanguage: '' });
    return String(result.preferredLanguage || '');
  }
  return localStorage.getItem('preferredLanguage') || '';
}

export async function setPreferredLanguage(value: string): Promise<void> {
  if (isExtensionEnvironment && chromeApi?.storage?.sync) {
    await chromeApi.storage.sync.set({ preferredLanguage: value });
    return;
  }
  localStorage.setItem('preferredLanguage', value);
}

const CONTEXT_KEY = 'globalContext';

export async function getSavedContext(): Promise<string> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    const result = await chromeApi.storage.local.get({ [CONTEXT_KEY]: '' });
    return String(result[CONTEXT_KEY] || '');
  }
  return localStorage.getItem(CONTEXT_KEY) || '';
}

export async function setSavedContext(value: string): Promise<void> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    await chromeApi.storage.local.set({ [CONTEXT_KEY]: value });
    return;
  }
  localStorage.setItem(CONTEXT_KEY, value);
}

export async function getRecentItems(): Promise<RecentAltItem[]> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    const { recentAlts } = await chromeApi.storage.local.get('recentAlts');
    if (Array.isArray(recentAlts)) return recentAlts as RecentAltItem[];
    return [];
  }
  try {
    const raw = localStorage.getItem('recentAlts');
    return raw ? (JSON.parse(raw) as RecentAltItem[]) : [];
  } catch {
    return [];
  }
}

export async function clearRecentItems(): Promise<void> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    await chromeApi.storage.local.set({ recentAlts: [] });
    return;
  }
  localStorage.removeItem('recentAlts');
}

export async function sendRuntimeMessage<T = unknown>(message: unknown): Promise<T> {
  if (isExtensionEnvironment && chromeApi?.runtime?.sendMessage) {
    return new Promise<T>((resolve, reject) => {
      chromeApi.runtime.sendMessage(message, (response) => {
        if (chromeApi.runtime.lastError) {
          reject(new Error(chromeApi.runtime.lastError.message));
          return;
        }
        resolve(response as T);
      });
    });
  }
  throw new Error('Runtime messaging unavailable');
}

export async function generateAltTextForDataUrl(dataUrl: string, context: string): Promise<{ altText: string; blendedAlt?: string }>
{
  const res = await sendRuntimeMessage<{ ok: boolean; altText?: string; blendedAlt?: string; error?: string }>({
    type: 'generateForDataUrl',
    dataUrl,
    context: { userContext: context },
  });
  if (!res?.ok) {
    throw new Error(res?.error || 'Generation failed');
  }
  return { altText: res.blendedAlt || res.altText || '' };
}

export async function downloadWithMetadata(item: UploadItem, altText: string): Promise<void> {
  const arrayBuffer = item.file ? await item.file.arrayBuffer() : dataUrlToArrayBuffer(item.dataUrl);
  const blob = await embedAltTextIntoImage(arrayBuffer, item.type || '', altText);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
