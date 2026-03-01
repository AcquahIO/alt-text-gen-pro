const SUPPORTED_BACKEND_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

export async function ensureMaxDataUrlSize(dataUrl: string, maxBytes = 1_100_000): Promise<string> {
  try {
    if (!dataUrl) return dataUrl;
    if (!Number.isFinite(maxBytes) || maxBytes <= 0) return dataUrl;
    const mime = getDataUrlMime(dataUrl);
    const needsConversion = Boolean(mime) && !SUPPORTED_BACKEND_MIMES.has(mime);
    const needsResize = estimateDataUrlBytes(dataUrl) > maxBytes;
    if (!needsConversion && !needsResize) return dataUrl;
    return await shrinkDataUrl(dataUrl, maxBytes, {
      forceConversion: needsConversion,
      targetMime: 'image/jpeg',
    });
  } catch {
    return dataUrl;
  }
}

function estimateDataUrlBytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  const idx = dataUrl.indexOf(',');
  const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  const pad = (base64.match(/=+$/) || [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - pad;
}

async function shrinkDataUrl(
  dataUrl: string,
  maxBytes: number,
  options: { forceConversion?: boolean; targetMime?: string } = {},
): Promise<string> {
  const { forceConversion = false, targetMime = 'image/jpeg' } = options;
  const bitmap = await decodeToBitmap(dataUrl);

  try {
    let width = bitmap.width || 1;
    let height = bitmap.height || 1;
    let quality = 0.92;
    let current = dataUrl;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      current = await renderBitmap(bitmap, Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), quality, targetMime);
      const sized = estimateDataUrlBytes(current) <= maxBytes;
      const converted = !forceConversion || getDataUrlMime(current) === targetMime;
      if (sized && converted) return current;
      width *= 0.8;
      height *= 0.8;
      quality = Math.max(0.5, quality * 0.85);
    }

    return current;
  } finally {
    if ('close' in bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }
}

async function decodeToBitmap(dataUrl: string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    const blob = dataUrlToBlob(dataUrl);
    return createImageBitmap(blob);
  }
  return loadImageElement(dataUrl);
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = dataUrl;
  });
}

async function renderBitmap(
  bitmap: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  quality: number,
  targetMime: string,
): Promise<string> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to obtain canvas context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: targetMime || 'image/jpeg', quality });
    return blobToDataUrl(blob);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to obtain canvas context');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL(targetMime || 'image/jpeg', quality);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const { mime, bytes } = dataUrlToBytes(dataUrl);
  return new Blob([toArrayBuffer(bytes)], { type: mime || 'application/octet-stream' });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const meta = parseDataUrl(dataUrl);
  if (!meta.isBase64) {
    const decoded = decodeURIComponent(meta.data);
    const arr = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) arr[i] = decoded.charCodeAt(i);
    return { mime: meta.mime || 'application/octet-stream', bytes: arr };
  }
  const binary = atob(meta.data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) arr[i] = binary.charCodeAt(i);
  return { mime: meta.mime || 'application/octet-stream', bytes: arr };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function getDataUrlMime(dataUrl: string): string {
  return (parseDataUrl(dataUrl).mime || 'application/octet-stream').toLowerCase();
}

function parseDataUrl(dataUrl: string): { mime: string; isBase64: boolean; data: string } {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/i.exec(String(dataUrl || ''));
  if (!match) return { mime: 'application/octet-stream', isBase64: false, data: '' };
  return {
    mime: match[1] || 'application/octet-stream',
    isBase64: Boolean(match[2]),
    data: match[3] || '',
  };
}
