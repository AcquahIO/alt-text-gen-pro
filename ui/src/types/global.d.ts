/// <reference types="chrome" />

declare module '@extension/utils/imageTools.js' {
  export function ensureMaxDataUrlSize(dataUrl: string, maxBytes?: number): Promise<string>;
}

declare module '@extension/utils/metadata.js' {
  export function embedAltTextIntoImage(arrayBuffer: ArrayBuffer, mimeType: string, altText: string): Promise<Blob>;
}
