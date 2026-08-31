import { embedAltTextMetadata } from '@extension/utils/metadata.js';
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
  return path.startsWith('icons/') ? `../${path}` : path;
}

export async function openFullPageView(): Promise<void> {
  const cacheBust = Date.now();
  const url = `${getRuntimeUrl('ui-dist/fullpage.html')}?v=${cacheBust}`;
  if (isExtensionEnvironment && chromeApi?.tabs?.create) {
    await new Promise<void>((resolve) => {
      chromeApi.tabs.create({ url }, () => resolve());
    });
  } else {
    window.open(url, '_blank');
  }
}

export async function storePendingUploads(
  entries: PendingUploadEntry[],
  extras: { language?: string; context?: string; focusKeyword?: string; brand?: string } = {},
): Promise<void> {
  if (!entries.length) {
    if (isExtensionEnvironment && chromeApi?.storage?.local) {
      await chromeApi.storage.local.remove('pendingUploads');
    } else {
      localStorage.removeItem('pendingUploads');
    }
    return;
  }
  const pendingPayload: StoredPendingUploads = {
    entries,
    language: extras.language,
    context: extras.context,
    focusKeyword: extras.focusKeyword,
    brand: extras.brand,
    when: Date.now(),
  };
  if (new Blob([JSON.stringify(pendingPayload)]).size > 8_000_000) {
    throw new Error('The image queue is too large. Remove a few images and try again.');
  }
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    await chromeApi.storage.local.set({ pendingUploads: pendingPayload });
    return;
  }
  try {
    localStorage.setItem('pendingUploads', JSON.stringify(pendingPayload));
  } catch (e) {
    console.warn('Fallback pending upload store failed', e);
  }
}

export async function getPendingUploads(): Promise<StoredPendingUploads | null> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    const result = await chromeApi.storage.local.get('pendingUploads');
    return (result.pendingUploads as StoredPendingUploads | undefined) ?? null;
  }
  try {
    const raw = localStorage.getItem('pendingUploads');
    return raw ? (JSON.parse(raw) as StoredPendingUploads) : null;
  } catch (e) {
    console.warn('Fallback pending upload read failed', e);
    return null;
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
const FOCUS_KEYWORD_KEY = 'focusKeyword';
const BRAND_KEY = 'brandName';

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

export async function getSavedFocusKeyword(): Promise<string> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    const result = await chromeApi.storage.local.get({ [FOCUS_KEYWORD_KEY]: '' });
    return String(result[FOCUS_KEYWORD_KEY] || '');
  }
  return localStorage.getItem(FOCUS_KEYWORD_KEY) || '';
}

export async function setSavedFocusKeyword(value: string): Promise<void> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    await chromeApi.storage.local.set({ [FOCUS_KEYWORD_KEY]: value });
    return;
  }
  localStorage.setItem(FOCUS_KEYWORD_KEY, value);
}

export async function getSavedBrand(): Promise<string> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    const result = await chromeApi.storage.local.get({ [BRAND_KEY]: '' });
    return String(result[BRAND_KEY] || '');
  }
  return localStorage.getItem(BRAND_KEY) || '';
}

export async function setSavedBrand(value: string): Promise<void> {
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    await chromeApi.storage.local.set({ [BRAND_KEY]: value });
    return;
  }
  localStorage.setItem(BRAND_KEY, value);
}

function toUserRecentKey(userId?: string): string {
  const id = String(userId || '').trim();
  return id ? `user:${id}` : '';
}

export async function getRecentItems(userId?: string): Promise<RecentAltItem[]> {
  const userKey = toUserRecentKey(userId);
  if (!userKey) return [];
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    const result = await chromeApi.storage.local.get({ recentAltsByUser: {} as Record<string, RecentAltItem[]> });
    const bucket = (result.recentAltsByUser || {})[userKey];
    if (Array.isArray(bucket)) return bucket as RecentAltItem[];
    return [];
  }
  try {
    const raw = localStorage.getItem(`recentAlts:${userKey}`);
    return raw ? (JSON.parse(raw) as RecentAltItem[]) : [];
  } catch {
    return [];
  }
}

export async function addRecentItem(userId: string, item: RecentAltItem): Promise<void> {
  const userKey = toUserRecentKey(userId);
  if (!userKey || !item.altText.trim()) return;
  const normalized: RecentAltItem = {
    altText: item.altText.trim(),
    srcUrl: item.srcUrl || '',
    pageTitle: item.pageTitle || '',
    when: item.when || Date.now(),
  };
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    const result = await chromeApi.storage.local.get({ recentAltsByUser: {} as Record<string, RecentAltItem[]> });
    const byUser = { ...(result.recentAltsByUser || {}) } as Record<string, RecentAltItem[]>;
    const current = Array.isArray(byUser[userKey]) ? byUser[userKey] : [];
    byUser[userKey] = [normalized, ...current].slice(0, 20);
    await chromeApi.storage.local.set({ recentAltsByUser: byUser });
    return;
  }
  const current = await getRecentItems(userId);
  localStorage.setItem(`recentAlts:${userKey}`, JSON.stringify([normalized, ...current].slice(0, 20)));
}

export async function clearRecentItems(userId?: string): Promise<void> {
  const userKey = toUserRecentKey(userId);
  if (!userKey) return;
  if (isExtensionEnvironment && chromeApi?.storage?.local) {
    const result = await chromeApi.storage.local.get({ recentAltsByUser: {} as Record<string, RecentAltItem[]> });
    const next = { ...(result.recentAltsByUser || {}) } as Record<string, RecentAltItem[]>;
    delete next[userKey];
    await chromeApi.storage.local.set({ recentAltsByUser: next });
    return;
  }
  localStorage.removeItem(`recentAlts:${userKey}`);
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

export async function queueActiveTabImagesForFullPage(
  extras: { language?: string; context?: string } = {},
): Promise<{ queued: number; discovered: number; truncated: boolean }> {
  const res = await sendRuntimeMessage<{
    ok: boolean;
    queued?: number;
    discovered?: number;
    truncated?: boolean;
    error?: string;
  }>({
    type: 'queueActiveTabImagesForFullPage',
    language: extras.language ?? '',
    context: extras.context ?? '',
  });
  if (!res?.ok) {
    throw new Error(res?.error || 'Unable to collect page images');
  }
  return {
    queued: Number(res.queued || 0),
    discovered: Number(res.discovered || 0),
    truncated: Boolean(res.truncated),
  };
}

export async function generateAltTextForImageSource(
  source: Pick<PendingUploadEntry, 'dataUrl' | 'sourceUrl' | 'pageContext' | 'contentTitle' | 'imageNotes' | 'imageRole'>,
  context: string | { pageContext?: string; focusKeyword?: string; brand?: string },
): Promise<{ altText: string; blendedAlt?: string }> {
  const requestContext = typeof context === 'string'
    ? {
        userContext: context,
        pageContext: [source.pageContext, context].filter(Boolean).join(' | '),
        title: source.contentTitle || '',
        dataHints: source.imageNotes || '',
        explicitRole: source.imageRole || '',
      }
    : {
        userContext: context.pageContext || '',
        pageContext: [source.pageContext, context.pageContext].filter(Boolean).join(' | '),
        focusKeyword: context.focusKeyword || '',
        brand: context.brand || '',
        title: source.contentTitle || '',
        dataHints: source.imageNotes || '',
        explicitRole: source.imageRole || '',
      };
  const res = await sendRuntimeMessage<{ ok: boolean; altText?: string; blendedAlt?: string; error?: string }>({
    type: 'generateForImageSource',
    dataUrl: source.dataUrl || '',
    imageUrl: source.sourceUrl || '',
    context: requestContext,
  });
  if (!res?.ok) {
    throw new Error(res?.error || 'Generation failed');
  }
  return { altText: res.blendedAlt || res.altText || '' };
}

export async function generateAltTextForDataUrl(
  dataUrl: string,
  context: string,
): Promise<{ altText: string; blendedAlt?: string }> {
  return generateAltTextForImageSource({ dataUrl }, context);
}

export async function downloadWithMetadata(
  item: UploadItem,
  altText: string,
): Promise<{ metadataEmbedded: boolean; reason: string | null }> {
  if (!item.dataUrl) {
    throw new Error('Metadata download is available for uploaded files only.');
  }
  const arrayBuffer = item.file ? await item.file.arrayBuffer() : dataUrlToArrayBuffer(item.dataUrl);
  const result = embedAltTextMetadata(arrayBuffer, item.type || '', altText);
  const bytes = new Uint8Array(result.bytes);
  const blob = new Blob([bytes.buffer], { type: result.outputFormat });
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
  return { metadataEmbedded: result.metadataEmbedded, reason: result.reason };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
