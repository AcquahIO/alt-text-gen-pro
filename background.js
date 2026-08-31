// background.js (service worker, MV3)
// Registers context menu, coordinates AI calls, and messaging.

import { t } from './utils/i18n.js';
import { inferRole } from './utils/composeAltText.js';
import { ensureMaxDataUrlSize } from './utils/imageTools.js';
import {
  FALLBACK_PRODUCTION_BASE,
  collectKnownRemoteOrigins,
  isLocalOrigin,
  isRecognizedOrigin,
  normalizeBaseUrl,
} from './utils/env.js';

const MENU_ID_IMAGE = 'alt-text-gen-image';
const DEFAULT_BACKEND = `${FALLBACK_PRODUCTION_BASE}/generate-alt-text`;
const DEFAULT_AUTH_BASE = FALLBACK_PRODUCTION_BASE;
const MAX_BACKEND_BYTES = 1100000;
const MAX_PAGE_CONTEXT_IMAGES = 20;

// Ensure the context menu exists whenever the service worker starts
function ensureContextMenu() {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: MENU_ID_IMAGE,
        title: chrome.i18n.getMessage('ctx_generate_alt') || 'Generate Alt Text',
        contexts: ['image', 'link'],
      });
    });
  } catch (e) {
    // Best-effort; in MV3, removeAll/create will usually succeed
  }
}

// Create on install/update and on startup; also on initial load
chrome.runtime.onInstalled.addListener(() => { ensureContextMenu(); ensureDefaultBackend(); });
if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(() => { ensureContextMenu(); ensureDefaultBackend(); });
ensureContextMenu();
ensureDefaultBackend();

async function ensureDefaultBackend() {
  try {
    const manifest = chrome.runtime?.getManifest?.();
    const knownRemotes = collectKnownRemoteOrigins({ manifest });
    const cfg = await chrome.storage.sync.get({ apiEndpoint: '', provider: '' });
    const syncUpdates = {};
    const currentOrigin = normalizeBaseUrl(cfg.apiEndpoint);
    if (!cfg.apiEndpoint || !isRecognizedOrigin(currentOrigin, knownRemotes)) {
      syncUpdates.apiEndpoint = DEFAULT_BACKEND;
    }
    if (!cfg.provider) syncUpdates.provider = 'custom';
    if (Object.keys(syncUpdates).length) {
      await chrome.storage.sync.set(syncUpdates);
    }

    const local = await chrome.storage.local.get({ authBaseUrl: '' });
    const localOrigin = normalizeBaseUrl(local.authBaseUrl);
    if (!isRecognizedOrigin(localOrigin, knownRemotes)) {
      await chrome.storage.local.set({ authBaseUrl: DEFAULT_AUTH_BASE });
    }
  } catch (err) {
    console.warn('ensureDefaultBackend failed', err);
  }
}

// When the toolbar icon is clicked, Chrome opens the default popup defined in manifest.

// (reverted) no onShown filtering; menu only appears for images

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;

  if (info.menuItemId === MENU_ID_IMAGE) {
    const srcUrl = await resolveClickedImageUrl(tab.id, info);
    if (!srcUrl) {
      await safeShowModal(tab.id, {
        type: 'showAltTextModal',
        altText: 'No image detected from this click. Try right-clicking directly on the picture, or use popup: Generate all images on this page.',
        srcUrl: '',
        isError: true,
      });
      return;
    }
    try {
      const ctxRaw = await collectContextFromTab(tab.id, srcUrl);
      const { visionDesc, ctx, role, blendedAlt } = await analysePipeline(srcUrl, ctxRaw);
      await saveRecent({ altText: blendedAlt, srcUrl, ctx });
      await chrome.tabs.sendMessage(tab.id, { type: 'showAltTextModal', altText: blendedAlt, srcUrl });
    } catch (err) {
      console.error('Alt text generation failed', err);
      chrome.tabs.sendMessage(tab.id, {
        type: 'showAltTextModal',
        altText: `Alt text generation failed: ${err?.message || err}`,
        srcUrl,
        isError: true,
      }).catch(() => {});
    }
    return;
  }
});

async function resolveClickedImageUrl(tabId, info) {
  const direct = String(info?.srcUrl || '').trim();
  if (direct) return direct;
  const linked = String(info?.linkUrl || '').trim();
  if (looksLikeImageUrl(linked)) return linked;
  try {
    const response = await sendToContent(tabId, { type: 'getContextMenuImageCandidate' });
    return String(response?.srcUrl || response?.candidates?.[0]?.url || '').trim();
  } catch {
    try {
      await ensureContentScript(tabId);
      const response2 = await sendToContent(tabId, { type: 'getContextMenuImageCandidate' });
      return String(response2?.srcUrl || response2?.candidates?.[0]?.url || '').trim();
    } catch {
      return '';
    }
  }
}

function looksLikeImageUrl(url) {
  const text = String(url || '').toLowerCase();
  if (!text) return false;
  if (text.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif|bmp|svg)(?:$|[?#])/i.test(text);
}

function collectContextFromTab(tabId, srcUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await sendToContent(tabId, { type: 'collectContext', srcUrl });
      resolve(response || {});
    } catch (e) {
      try {
        await ensureContentScript(tabId);
        const response2 = await sendToContent(tabId, { type: 'collectContext', srcUrl });
        resolve(response2 || {});
      } catch (e2) {
        reject(e2);
      }
    }
  });
}

// Handle regenerate requests and popup upload requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === 'regenerateAltText') {
      const { srcUrl, context } = message;
      const { visionDesc, ctx, role, blendedAlt } = await analysePipeline(srcUrl, context);
      await saveRecent({ altText: blendedAlt, srcUrl, ctx });
      if (sender.tab?.id) await safeShowModal(sender.tab.id, { type: 'updateAltTextModal', altText: blendedAlt });
      sendResponse({ ok: true });
      return;
    }
    if (message?.type === 'generateForDataUrl' || message?.type === 'generateForImageSource') {
      const { dataUrl, imageUrl, context } = message;
      const imageSource = String(dataUrl || imageUrl || '').trim();
      if (!imageSource) throw new Error('Image source is missing');
      const { visionDesc, ctx, role, blendedAlt } = await analysePipeline(imageSource, context);
      sendResponse({ ok: true, altText: blendedAlt });
      return;
    }
    if (message?.type === 'queueActiveTabImagesForFullPage') {
      const tabId = Number.isInteger(message?.tabId) ? message.tabId : await getActiveTabId();
      if (!Number.isInteger(tabId)) {
        throw new Error('No active webpage tab found');
      }
      const queued = await queuePageImagesForFullPage({
        tabId,
        language: message?.language,
        context: message?.context,
      });
      sendResponse({ ok: true, ...queued });
      return;
    }
  })().catch((e) => {
    console.error(e);
    sendResponse({ ok: false, error: e?.message || String(e) });
  });
  return true; // keep channel open for async
});

// Helper: send a message to content with retry after injection
function sendToContent(tabId, payload) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, payload, (response) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message));
        resolve(response);
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (e) {
    // ignore if not permitted (e.g., chrome://) or already injected
  }
}

async function safeShowModal(tabId, payload) {
  try {
    await sendToContent(tabId, payload);
  } catch {
    await ensureContentScript(tabId);
    try { await sendToContent(tabId, payload); } catch {}
  }
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs?.find((candidate) => /^https?:/i.test(candidate?.url || ''));
  return tab?.id;
}

async function queuePageImagesForFullPage({ tabId, language, context } = {}) {
  if (!Number.isInteger(tabId)) return { queued: 0, discovered: 0, truncated: false };
  const pageImages = await collectPageImagesFromTab(tabId);
  if (!pageImages.length) return { queued: 0, discovered: 0, truncated: false };

  const deduped = [];
  const seen = new Set();
  for (const item of pageImages) {
    const url = String(item?.url || '');
    if (!url || seen.has(url)) continue;
    seen.add(url);
    deduped.push(item);
    if (deduped.length >= MAX_PAGE_CONTEXT_IMAGES) break;
  }

  const discovered = new Set(
    pageImages
      .map((item) => String(item?.url || ''))
      .filter(Boolean),
  ).size;

  const entries = [];
  for (let i = 0; i < deduped.length; i++) {
    const entry = await buildPendingEntryFromImageCandidate(deduped[i], i);
    if (entry) entries.push(entry);
  }
  if (!entries.length) return { queued: 0, discovered, truncated: discovered > MAX_PAGE_CONTEXT_IMAGES };

  const [syncCfg, localCfg] = await Promise.all([
    chrome.storage.sync.get({ preferredLanguage: '' }).catch(() => ({ preferredLanguage: '' })),
    chrome.storage.local.get({ globalContext: '' }).catch(() => ({ globalContext: '' })),
  ]);
  const finalLanguage = String((language ?? syncCfg.preferredLanguage ?? '') || '');
  const finalContext = String((context ?? localCfg.globalContext ?? '') || '');
  const notice = discovered > MAX_PAGE_CONTEXT_IMAGES
    ? `Queued ${entries.length} of ${discovered} images. Page scans are limited to ${MAX_PAGE_CONTEXT_IMAGES} images at a time.`
    : '';

  await chrome.storage.local.set({
    pendingUploads: {
      when: Date.now(),
      entries,
      language: finalLanguage,
      context: finalContext,
      notice,
    },
  });
  return {
    queued: entries.length,
    discovered,
    truncated: discovered > MAX_PAGE_CONTEXT_IMAGES,
  };
}

async function collectPageImagesFromTab(tabId) {
  try {
    const response = await sendToContent(tabId, { type: 'collectPageImages' });
    return Array.isArray(response?.images) ? response.images : [];
  } catch (e) {
    try {
      await ensureContentScript(tabId);
      const response2 = await sendToContent(tabId, { type: 'collectPageImages' });
      return Array.isArray(response2?.images) ? response2.images : [];
    } catch (secondError) {
      throw new Error(`This page does not allow image scanning: ${secondError?.message || 'access denied'}`);
    }
  }
}

async function buildPendingEntryFromImageCandidate(candidate, index) {
  const imageUrl = String(candidate?.url || '').trim();
  if (!imageUrl) return null;
  const isDataUrl = /^data:image\//i.test(imageUrl);
  const isRemoteUrl = /^https?:\/\//i.test(imageUrl);
  if (!isDataUrl && !isRemoteUrl) return null;

  const dataUrl = isDataUrl
    ? await ensureMaxDataUrlSize(imageUrl, MAX_BACKEND_BYTES).catch(() => imageUrl)
    : '';
  const sourceUrl = isRemoteUrl ? imageUrl : '';

  const fallbackName = deriveImageName(imageUrl, index);
  const name = sanitizeImageName(candidate?.name || fallbackName);
  const type = getMimeFromDataUrl(dataUrl) || String(candidate?.type || '') || 'image/jpeg';
  const size = dataUrl ? estimateDataUrlBytes(dataUrl) : 0;
  const candidateContext = candidate?.context && typeof candidate.context === 'object' ? candidate.context : {};
  const pageContext = [
    candidateContext.title,
    candidateContext.meta,
    candidateContext.nearestHeading,
    candidateContext.anchorText,
    candidateContext.alt,
  ].filter(Boolean).join(' | ').slice(0, 4000);
  return {
    name,
    type,
    size,
    dataUrl,
    sourceUrl,
    pageContext,
    contentTitle: String(candidateContext.nearestHeading || candidateContext.title || '').slice(0, 500),
    imageNotes: String(candidateContext.dataHints || candidateContext.aria || '').slice(0, 1000),
    imageRole: String(candidateContext.explicitRole || '').slice(0, 100),
  };
}

function deriveImageName(url, index) {
  try {
    const parsed = new URL(url);
    const lastSegment = decodeURIComponent(parsed.pathname.split('/').pop() || '');
    if (lastSegment) return lastSegment;
  } catch {}
  return `image-${index + 1}.jpg`;
}

function sanitizeImageName(name) {
  const cleaned = String(name || '').trim().replace(/[\\/:*?"<>|]+/g, '_');
  return cleaned || `image-${Date.now()}.jpg`;
}

function getMimeFromDataUrl(dataUrl) {
  const match = /^data:([^;,]+)[;,]/i.exec(String(dataUrl || ''));
  return match?.[1] || '';
}

function estimateDataUrlBytes(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  if (!base64) return 0;
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

// Pipeline: vision → compose
async function analysePipeline(imageUrlOrDataUrl, ctxRaw) {
  const ctx = getPageContext(ctxRaw);
  const role = inferRole(ctx);
  const [cfg, localState] = await Promise.all([
    chrome.storage.sync.get({ apiEndpoint: '', preferredLanguage: '' }),
    chrome.storage.local.get({ auth: null }),
  ]);
  const endpoint = (cfg.apiEndpoint || '').trim();
  const language = (cfg.preferredLanguage || ctx.pageLang || navigator.language || '').toString();
  const authToken = String(localState?.auth?.token || '').trim();
  const backendCredential = selectBackendCredential({ endpoint, authToken });
  if (!endpoint) throw new Error('Generation service is not configured. Reopen the extension and try again.');
  try {
    const { alt } = await callBackendEndpoint(endpoint, imageUrlOrDataUrl, ctx, backendCredential, language);
    const finalAlt = alt || '';
    return { visionDesc: finalAlt, ctx, role, blendedAlt: finalAlt };
  } catch (error) {
    throw normalizeBackendErrorForUser(error);
  }
}

async function callBackendEndpoint(endpoint, imageUrlOrDataUrl, ctx, sharedKey, language) {
  const isData = /^data:/i.test(imageUrlOrDataUrl || '');
  const payload = {
    context: {
      client_scope: 'chrome',
      page_context: [ctx?.nearestHeading, ctx?.meta, ctx?.title, ctx?.pageContext, ctx?.userContext].filter(Boolean).join(' | '),
      content_title: ctx?.nearestHeading || ctx?.title || '',
      focus_keyword: ctx?.focusKeyword || ctx?.userContext || '',
      brand: ctx?.brand || '',
      image_role: inferRole(ctx),
      image_notes: ctx?.dataHints || '',
    },
    language: language || '',
  };
  if (isData) {
    const safeDataUrl = await ensureMaxDataUrlSize(imageUrlOrDataUrl, MAX_BACKEND_BYTES);
    payload.image_base64 = safeDataUrl;
  }
  else payload.image_url = imageUrlOrDataUrl;

  const headers = {
    'Content-Type': 'application/json',
    'X-Client-Scope': 'chrome',
  };
  if (sharedKey) {
    if (sharedKey.split('.').length === 3) {
      // JWT path for signed-in backend flow.
      headers['Authorization'] = `Bearer ${sharedKey}`;
    } else {
      // Shared backend key path.
      headers['X-API-Key'] = sharedKey;
    }
  }

  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`backend ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    err.backend = true;
    err.body = text;
    throw err;
  }
  const data = await res.json();
  const alt = (data.alt_text || '').toString().trim();
  return { alt };
}

function selectBackendCredential({ endpoint, authToken }) {
  const token = String(authToken || '').trim();
  if (!token || token.split('.').length !== 3) return '';

  const endpointOrigin = normalizeBaseUrl(endpoint);
  if (!endpointOrigin) return '';

  const manifest = chrome.runtime?.getManifest?.();
  const knownRemotes = collectKnownRemoteOrigins({ manifest });
  if (!isRecognizedOrigin(endpointOrigin, knownRemotes)) return '';

  return token;
}

function normalizeBackendErrorForUser(err) {
  if (!err) return new Error('Generation service request failed.');
  const status = Number(err.status) || 0;
  const backendMessage = parseBackendErrorMessage(err).toLowerCase();
  if (status === 413) {
    return new Error('Image is too large to process. Try a smaller image.');
  }
  if (status === 402) {
    return new Error('Your plan does not include Chrome generation. Upgrade your subscription to continue.');
  }
  if (status === 429) {
    return new Error('Generation limit reached for this period. Please wait and try again.');
  }
  if (status === 401 || status === 403) {
    if (backendMessage.includes('sign in')) {
      return new Error('Sign in required for generation. Open the extension popup and sign in.');
    }
    if (backendMessage.includes('invalid') || backendMessage.includes('expired')) {
      return new Error('Your session expired. Sign in again from the extension popup.');
    }
    return new Error('The generation service rejected the request. Sign in again and retry.');
  }
  return new Error(err.message || 'Generation service request failed.');
}

function parseBackendErrorMessage(err) {
  const body = String(err?.body || '').trim();
  if (!body) return '';
  try {
    const parsed = JSON.parse(body);
    return String(parsed?.message || parsed?.error || '').trim();
  } catch {
    return body;
  }
}

async function saveRecent(entry) {
  try {
    const state = await chrome.storage.local.get({ recentAltsByUser: {}, auth: null });
    const auth = state?.auth || null;
    const userId = String(auth?.userId || '').trim();
    const userKey = userId ? `user:${userId}` : 'anon';
    const byUser = state?.recentAltsByUser && typeof state.recentAltsByUser === 'object'
      ? state.recentAltsByUser
      : {};
    const arr = Array.isArray(byUser[userKey]) ? byUser[userKey] : [];
    const item = {
      altText: (entry.altText || '').toString(),
      srcUrl: entry.srcUrl || '',
      pageTitle: entry.ctx?.title || '',
      when: Date.now(),
    };
    arr.unshift(item);
    const trimmed = arr.slice(0, 20);
    await chrome.storage.local.set({
      recentAltsByUser: {
        ...byUser,
        [userKey]: trimmed,
      },
    });
  } catch {}
}

/**
 * Turn raw DOM details from the content script into a PageContext shape.
 */
export function getPageContext(raw) {
  const fileName = (() => {
    try { return (new URL(raw?.src || '')).pathname.split('/').pop() || ''; } catch { return ''; }
  })();
  const ctx = {
    title: raw?.title || '',
    nearestHeading: raw?.nearestHeading || '',
    anchorText: raw?.anchorText || '',
    aria: raw?.aria || '',
    dataHints: raw?.dataHints || '',
    fileName,
    alt: raw?.alt || '',
    explicitRole: raw?.explicitRole || '',
    isSmallSquare: !!raw?.isSmallSquare,
    size: raw?.size || undefined,
    pageLang: raw?.pageLang || '',
    meta: raw?.meta || '',
    userContext: raw?.userContext || '',
    pageContext: raw?.pageContext || '',
    focusKeyword: raw?.focusKeyword || '',
    brand: raw?.brand || '',
  };
  return ctx;
}
