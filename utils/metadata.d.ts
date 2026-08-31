export interface EmbeddedMetadataResult {
  bytes: Uint8Array;
  originalFormat: string;
  outputFormat: string;
  metadataEmbedded: boolean;
  reason: string | null;
}

export function embedAltTextMetadata(
  arrayBuffer: ArrayBuffer,
  mimeType: string,
  altText: string,
): EmbeddedMetadataResult;

export function embedAltTextIntoImage(
  arrayBuffer: ArrayBuffer,
  mimeType: string,
  altText: string,
): Promise<Blob>;
