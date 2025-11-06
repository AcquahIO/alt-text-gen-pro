// utils/imageTools.js
// Helpers for resizing/compressing images represented as data URLs so they stay within backend limits.

const SUPPORTED_BACKEND_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

export async function ensureMaxDataUrlSize(dataUrl, maxBytes = Infinity) {
  try {
    if (!dataUrl) return dataUrl;
    if (!Number.isFinite(maxBytes) || maxBytes <= 0) return dataUrl;
    const meta = parseDataUrl(dataUrl);
    const mime = (meta.mime || '').toLowerCase();
    const needsConversion = mime && !SUPPORTED_BACKEND_MIMES.has(mime);
    const needsResize = estimateDataUrlBytes(dataUrl) > maxBytes;
    if (!needsConversion && !needsResize) return dataUrl;
    return await shrinkDataUrl(dataUrl, maxBytes, { forceConversion: needsConversion, targetMime: 'image/jpeg' });
  } catch (e) {
    console.warn('ensureMaxDataUrlSize failed; returning original data URL', e);
    return dataUrl;
  }
}

function estimateDataUrlBytes(dataUrl) {
  if (!dataUrl) return 0;
  const idx = dataUrl.indexOf(',');
  const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  const pad = (base64.match(/=+$/) || [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - pad;
}

async function shrinkDataUrl(dataUrl, maxBytes, options = {}) {
  const { forceConversion = false, targetMime = 'image/jpeg' } = options;
  const bitmap = await decodeToBitmap(dataUrl);
  try {
    let width = bitmap.width || 1;
    let height = bitmap.height || 1;
    let quality = 0.92;
    let attempt = 0;
    let current = dataUrl;
    while (attempt < 6) {
      const result = await renderBitmap(
        bitmap,
        Math.max(1, Math.round(width)),
        Math.max(1, Math.round(height)),
        quality,
        targetMime,
      );
      current = result;
      const sized = estimateDataUrlBytes(current) <= maxBytes;
      const converted = !forceConversion || getDataUrlMime(current) === targetMime;
      if (sized && converted) return current;
      width *= 0.8;
      height *= 0.8;
      quality = Math.max(0.5, quality * 0.85);
      attempt += 1;
    }
    return current;
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      try { bitmap.close(); } catch {}
    }
  }
}

async function decodeToBitmap(dataUrl) {
  if (typeof createImageBitmap === 'function') {
    const blob = dataUrlToBlob(dataUrl);
    return await createImageBitmap(blob);
  }
  return await loadImageElement(dataUrl);
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = dataUrl;
  });
}

async function renderBitmap(bitmap, width, height, quality, targetMime) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: targetMime || 'image/jpeg', quality });
    return await blobToDataUrl(blob);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL(targetMime || 'image/jpeg', quality);
  }
  throw new Error('Canvas rendering not available in this context');
}

function dataUrlToBlob(dataUrl) {
  const { mime, bytes } = dataUrlToBytes(dataUrl);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBytes(dataUrl) {
  const meta = parseDataUrl(dataUrl);
  if (!meta.isBase64) {
    const decoded = decodeURIComponent(meta.data);
    const arr = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) arr[i] = decoded.charCodeAt(i);
    return { mime: meta.mime || 'application/octet-stream', bytes: arr };
  }
  const bin = atob(meta.data);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return { mime: meta.mime || 'application/octet-stream', bytes: arr };
}

function getDataUrlMime(dataUrl) {
  const meta = parseDataUrl(dataUrl);
  return (meta.mime || 'application/octet-stream').toLowerCase();
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/i.exec(String(dataUrl || ''));
  if (!match) return { mime: 'application/octet-stream', isBase64: false, data: '' };
  return {
    mime: match[1] || 'application/octet-stream',
    isBase64: !!match[2],
    data: match[3] || '',
  };
}
