// background.js (service worker, MV3)
// Registers context menu, coordinates AI calls, and messaging.

import { t } from './utils/i18n.js';
import { getOpenAIClient } from './utils/openaiClient.js';
import { composeAltText, validateAltText, inferRole, normalize } from './utils/composeAltText.js';
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
    if (message?.type === 'generateForDataUrl') {
      const { dataUrl, context } = message;
      const { visionDesc, ctx, role, blendedAlt } = await analysePipeline(dataUrl, context);
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
      sendResponse({ ok: true, queued });
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
      target: { tabId, allFrames: true },
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
  if (!Number.isInteger(tabId)) return 0;
  const pageImages = await collectPageImagesFromTab(tabId);
  if (!pageImages.length) return 0;

  const deduped = [];
  const seen = new Set();
  for (const item of pageImages) {
    const url = String(item?.url || '');
    if (!url || seen.has(url)) continue;
    seen.add(url);
    deduped.push(item);
    if (deduped.length >= MAX_PAGE_CONTEXT_IMAGES) break;
  }

  const entries = [];
  for (let i = 0; i < deduped.length; i++) {
    const entry = await buildPendingEntryFromImageCandidate(deduped[i], i);
    if (entry) entries.push(entry);
  }
  if (!entries.length) return 0;

  const [syncCfg, localCfg] = await Promise.all([
    chrome.storage.sync.get({ preferredLanguage: '' }).catch(() => ({ preferredLanguage: '' })),
    chrome.storage.local.get({ globalContext: '' }).catch(() => ({ globalContext: '' })),
  ]);
  const finalLanguage = String((language ?? syncCfg.preferredLanguage ?? '') || '');
  const finalContext = String((context ?? localCfg.globalContext ?? '') || '');

  await chrome.storage.local.set({
    pendingUploads: {
      when: Date.now(),
      entries,
      language: finalLanguage,
      context: finalContext,
    },
  });
  return entries.length;
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
    } catch {
      return [];
    }
  }
}

async function buildPendingEntryFromImageCandidate(candidate, index) {
  const imageUrl = String(candidate?.url || '').trim();
  if (!imageUrl) return null;
  const dataUrl = await getImageDataUrl(imageUrl);
  if (!dataUrl) return null;

  const fallbackName = deriveImageName(imageUrl, index);
  const name = sanitizeImageName(candidate?.name || fallbackName);
  const type = getMimeFromDataUrl(dataUrl) || String(candidate?.type || '') || 'image/jpeg';
  const size = estimateDataUrlBytes(dataUrl);
  return { name, type, size, dataUrl };
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

// Fetch image bytes and convert to data URL for reliable vision input
async function getImageDataUrl(url) {
  try {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const ct = res.headers.get('content-type') || 'image/jpeg';
    const buf = await res.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    return `data:${ct};base64,${b64}`;
  } catch (e) {
    console.warn('Image fetch failed; falling back to URL', e);
    return null;
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  // btoa handles binary strings
  return btoa(binary);
}

// Pipeline: vision → compose
async function analysePipeline(imageUrlOrDataUrl, ctxRaw) {
  const ctx = getPageContext(ctxRaw);
  const role = inferRole(ctx);
  const [cfg, localState] = await Promise.all([
    chrome.storage.sync.get({ apiEndpoint: '', apiKey: '', preferredLanguage: '' }),
    chrome.storage.local.get({ auth: null }),
  ]);
  const endpoint = (cfg.apiEndpoint || '').trim();
  const language = (cfg.preferredLanguage || ctx.pageLang || navigator.language || '').toString();
  const authToken = String(localState?.auth?.token || '').trim();
  const backendCredential = selectBackendCredential({
    endpoint,
    authToken,
    sharedOrApiKey: cfg.apiKey || '',
  });

  // If a backend endpoint is configured, use it (no client-side OpenAI key required)
  let backendError = null;
  if (endpoint) {
    try {
      const { alt } = await callBackendEndpoint(endpoint, imageUrlOrDataUrl, ctx, backendCredential, language);
      const finalAlt = alt || '';
      return { visionDesc: finalAlt, ctx, role, blendedAlt: finalAlt };
    } catch (e) {
      backendError = e;
      console.warn('Backend call failed, falling back to local vision:', e?.message || e);
    }
  }

  const apiKey = (cfg.apiKey || '').trim();
  if (!apiKey) {
    if (backendError) throw normalizeBackendErrorForUser(backendError);
    throw new Error('Missing OpenAI API key');
  }
  if (!looksLikeOpenAiKey(apiKey)) {
    if (backendError) throw normalizeBackendErrorForUser(backendError);
    throw new Error('Configured API key is not a valid OpenAI key');
  }

  // Fallback to client-side OpenAI vision if backend unavailable
  const visionDesc = await analyseImageWithVision(imageUrlOrDataUrl, language);
  let alt = composeAltText(visionDesc, ctx, role);
  let valid = validateAltText(alt).ok;
  if (!valid) {
    const retryVision = await analyseImageWithVision(imageUrlOrDataUrl, language);
    alt = composeAltText(retryVision || visionDesc, ctx, role);
  }
  return { visionDesc: normalize(visionDesc), ctx, role, blendedAlt: alt };
}

async function callBackendEndpoint(endpoint, imageUrlOrDataUrl, ctx, sharedKey, language) {
  const isData = /^data:/i.test(imageUrlOrDataUrl || '');
  const payload = {
    model: 'gpt-4o',
    context: {
      client_scope: 'chrome',
      page_context: [ctx?.nearestHeading, ctx?.title].filter(Boolean).join(' | '),
      image_role: inferRole(ctx),
      image_notes: ctx?.dataHints || '',
    },
    language: language || '',
  };
  if (isData) {
    const safeDataUrl = await ensureMaxDataUrlSize(imageUrlOrDataUrl, MAX_BACKEND_BYTES);
    payload.image_base64 = safeDataUrl.replace(/^data:[^,]+;base64,/, '');
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

function selectBackendCredential({ endpoint, authToken, sharedOrApiKey }) {
  const token = String(authToken || '').trim();
  const fallbackKey = String(sharedOrApiKey || '').trim();
  if (!token || token.split('.').length !== 3) return fallbackKey;

  const endpointOrigin = normalizeBaseUrl(endpoint);
  if (!endpointOrigin) return fallbackKey;

  const manifest = chrome.runtime?.getManifest?.();
  const knownRemotes = collectKnownRemoteOrigins({ manifest });
  if (!isRecognizedOrigin(endpointOrigin, knownRemotes)) return fallbackKey;

  return token;
}

function normalizeBackendErrorForUser(err) {
  if (!err) return new Error('Backend request failed and no OpenAI API key is set.');
  const status = Number(err.status) || 0;
  const backendMessage = parseBackendErrorMessage(err).toLowerCase();
  if (status === 413) {
    return new Error('Image is too large for the shared backend (~2 MB limit). Try a smaller image or add your own OpenAI API key.');
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
    return new Error('Backend rejected the request. Check the shared key or configure your own OpenAI API key.');
  }
  return new Error(err.message || 'Backend request failed and no OpenAI API key is set.');
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
 * Fetch image, convert to base64, and call OpenAI vision (Chat Completions)
 * @param {string} imageUrl
 * @returns {Promise<string>} vision description string
 */
export async function analyseImageWithVision(imageUrl, language) {
  const cfg = await chrome.storage.sync.get({ apiKey: '', model: 'gpt-4o' });
  const apiKey = (cfg.apiKey || '').trim();
  const model = sanitizeModel((cfg.model || 'gpt-4o').trim());
  if (!apiKey) throw new Error('Missing OpenAI API key');
  if (!looksLikeOpenAiKey(apiKey)) throw new Error('Configured API key is not a valid OpenAI key');

  // Fetch as bytes. If it's a data URL we can pass through.
  let dataUrl = '';
  if (/^data:/i.test(imageUrl)) {
    dataUrl = imageUrl;
  } else {
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (!res.ok) throw new Error(`Image fetch ${res.status}`);
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    const ct = blob.type || 'image/*';
    dataUrl = `data:${ct};base64,${b64}`;
  }

  const client = getOpenAIClient(apiKey);
  const langNote = (language || '').trim();
  const sys = `You produce alt text from the visual content only. Output ONE concise line in ${langNote || 'the user\'s language'}. Keep it \u2264120 characters, no quotes, no hashtags, no pipes, no prefixes like 'Image of'. Avoid marketing and keyword stuffing. Follow the target language\'s conventions.`;
  const body = {
    model,
    temperature: 0.2,
    max_tokens: 60,
    messages: [
      { role: 'system', content: sys },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the main visible subject for alt text only.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  };
  const json = await client.chat.completions.create(body);
  const text = json?.choices?.[0]?.message?.content || '';
  return normalize(text);
}

function sanitizeModel(m) {
  // correct common mistakes and unsupported models
  if (!m) return 'gpt-4o';
  // typos or shorthand
  if (/^apt-4o$/i.test(m) || /^gpt4o$/i.test(m) || /^4o$/i.test(m)) return 'gpt-4o';
  // image generation model is not suitable for vision understanding
  if (/^gpt-image/i.test(m)) return 'gpt-4o';
  // default to a known multimodal chat model
  return m || 'gpt-4o';
}

function looksLikeOpenAiKey(value) {
  const key = String(value || '').trim();
  // Covers standard and project keys (e.g. sk-..., sk-proj-...), plus short-lived session keys.
  return /^sk-|^sess-/i.test(key);
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
  };
  return ctx;
}
