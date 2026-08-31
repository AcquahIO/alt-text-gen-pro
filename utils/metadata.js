const encoder = new TextEncoder();
const decoder = new TextDecoder();

const MIME_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Embed alt-text metadata without decoding or recompressing the source image.
 * The returned bytes always keep the source image format.
 */
export function embedAltTextMetadata(arrayBuffer, mimeType, altText) {
  const source = new Uint8Array(arrayBuffer);
  const detected = detectFormat(source);
  const declaredMime = normalizeDeclaredMime(mimeType);
  const declared = normalizeMimeType(declaredMime);
  const format = detected || declared;

  if (!format || !MIME_BY_FORMAT[format]) {
    return unchanged(source, declaredMime, 'Unsupported image format; the original file was left unchanged.');
  }

  try {
    if (format === 'jpeg') {
      if (detected !== 'jpeg') {
        return unchanged(source, format, 'The file contents do not match a valid JPEG image.');
      }
      return embedded(embedJpeg(source, altText), format);
    }

    if (format === 'png') {
      if (detected !== 'png') {
        return unchanged(source, format, 'The file contents do not match a valid PNG image.');
      }
      return embedded(embedPng(source, altText), format);
    }

    if (format === 'webp') {
      if (detected !== 'webp') {
        return unchanged(source, format, 'The file contents do not match a valid WebP image.');
      }
      const bytes = embedWebp(source, altText);
      if (!bytes) {
        return unchanged(source, format, 'The WebP dimensions could not be read, so the original file was left unchanged.');
      }
      return embedded(bytes, format);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown metadata error.';
    return unchanged(source, format, `Metadata could not be embedded: ${message}`);
  }

  return unchanged(source, format, 'Unsupported image format; the original file was left unchanged.');
}

/**
 * Backwards-compatible browser helper used by the extension download flow.
 */
export async function embedAltTextIntoImage(arrayBuffer, mimeType, altText) {
  const result = embedAltTextMetadata(arrayBuffer, mimeType, altText);
  return new Blob([result.bytes], { type: result.outputFormat });
}

function embedded(bytes, format) {
  return {
    bytes,
    originalFormat: MIME_BY_FORMAT[format],
    outputFormat: MIME_BY_FORMAT[format],
    metadataEmbedded: true,
    reason: null,
  };
}

function unchanged(source, formatOrMime, reason) {
  const outputFormat = MIME_BY_FORMAT[formatOrMime]
    || (String(formatOrMime || '').startsWith('image/') ? String(formatOrMime) : 'application/octet-stream');
  return {
    bytes: source.slice(),
    originalFormat: outputFormat,
    outputFormat,
    metadataEmbedded: false,
    reason,
  };
}

function normalizeDeclaredMime(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function normalizeMimeType(value) {
  const mime = normalizeDeclaredMime(value);
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpeg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return null;
}

function detectFormat(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) return 'png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  return null;
}

function buildXmpPacket(altText) {
  const escaped = escapeXml(String(altText || ''));
  return encoder.encode(
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<dc:description><rdf:Alt><rdf:li xml:lang="x-default">' + escaped +
    '</rdf:li></rdf:Alt></dc:description>' +
    '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>',
  );
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function embedJpeg(source, altText) {
  const xmpHeader = encoder.encode('http://ns.adobe.com/xap/1.0/\0');
  const packet = buildXmpPacket(altText);
  const payload = concat(xmpHeader, packet);
  const segmentLength = payload.length + 2;
  if (segmentLength > 0xffff) throw new Error('Alt text is too long for a JPEG XMP segment.');

  const segment = new Uint8Array(payload.length + 4);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = (segmentLength >>> 8) & 0xff;
  segment[3] = segmentLength & 0xff;
  segment.set(payload, 4);

  return concat(source.subarray(0, 2), segment, source.subarray(2));
}

function embedPng(source, altText) {
  const chunks = parsePngChunks(source);
  const keyword = encoder.encode('Description');
  const text = encoder.encode(String(altText || ''));
  const internationalText = concat(keyword, new Uint8Array([0, 0, 0, 0, 0]), text);
  const descriptionChunk = buildPngChunk('iTXt', internationalText);
  const output = [source.subarray(0, 8)];
  let inserted = false;

  for (const chunk of chunks) {
    if (chunk.type === 'iTXt' && pngTextKeyword(chunk.data) === 'Description') continue;
    if (chunk.type === 'IEND' && !inserted) {
      output.push(descriptionChunk);
      inserted = true;
    }
    output.push(chunk.raw);
  }

  if (!inserted) throw new Error('PNG is missing its IEND chunk.');
  return concat(...output);
}

function parsePngChunks(source) {
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= source.length) {
    const length = readU32BE(source, offset);
    const end = offset + 12 + length;
    if (end > source.length) throw new Error('PNG contains an incomplete chunk.');
    const type = ascii(source, offset + 4, 4);
    chunks.push({
      type,
      data: source.subarray(offset + 8, offset + 8 + length),
      raw: source.subarray(offset, end),
    });
    offset = end;
    if (type === 'IEND') break;
  }
  return chunks;
}

function pngTextKeyword(data) {
  const end = data.indexOf(0);
  return end < 0 ? '' : decoder.decode(data.subarray(0, end));
}

function buildPngChunk(type, data) {
  const typeBytes = encoder.encode(type);
  const output = new Uint8Array(data.length + 12);
  writeU32BE(output, 0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  writeU32BE(output, data.length + 8, crc32(concat(typeBytes, data)));
  return output;
}

function embedWebp(source, altText) {
  const chunks = parseWebpChunks(source);
  const xmpChunk = buildWebpChunk('XMP ', buildXmpPacket(altText));
  const outputChunks = [];
  const first = chunks[0];
  let hasVp8x = first?.type === 'VP8X';

  if (hasVp8x) {
    const payload = first.data.slice();
    if (payload.length < 10) throw new Error('WebP has an invalid VP8X chunk.');
    payload[0] |= 0x04;
    outputChunks.push(buildWebpChunk('VP8X', payload));
  } else {
    const dimensions = readWebpDimensions(chunks);
    if (!dimensions) return null;
    const payload = new Uint8Array(10);
    payload[0] = webpFeatureFlags(chunks) | 0x04;
    writeU24LE(payload, 4, dimensions.width - 1);
    writeU24LE(payload, 7, dimensions.height - 1);
    outputChunks.push(buildWebpChunk('VP8X', payload));
  }

  for (let index = hasVp8x ? 1 : 0; index < chunks.length; index += 1) {
    if (chunks[index].type !== 'XMP ') outputChunks.push(chunks[index].raw);
  }
  outputChunks.push(xmpChunk);

  const body = concat(...outputChunks);
  const header = new Uint8Array(12);
  header.set(encoder.encode('RIFF'), 0);
  writeU32LE(header, 4, body.length + 4);
  header.set(encoder.encode('WEBP'), 8);
  return concat(header, body);
}

function webpFeatureFlags(chunks) {
  let flags = 0;
  for (const chunk of chunks) {
    if (chunk.type === 'ICCP') flags |= 0x20;
    if (chunk.type === 'ALPH') flags |= 0x10;
    if (chunk.type === 'EXIF') flags |= 0x08;
    if (chunk.type === 'ANIM' || chunk.type === 'ANMF') flags |= 0x02;
  }
  return flags;
}

function parseWebpChunks(source) {
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= source.length) {
    const type = ascii(source, offset, 4);
    const length = readU32LE(source, offset + 4);
    const paddedLength = length + (length % 2);
    const end = offset + 8 + paddedLength;
    if (end > source.length) throw new Error('WebP contains an incomplete chunk.');
    chunks.push({
      type,
      data: source.subarray(offset + 8, offset + 8 + length),
      raw: source.subarray(offset, end),
    });
    offset = end;
  }
  return chunks;
}

function readWebpDimensions(chunks) {
  for (const chunk of chunks) {
    if (chunk.type === 'VP8X' && chunk.data.length >= 10) {
      return { width: readU24LE(chunk.data, 4) + 1, height: readU24LE(chunk.data, 7) + 1 };
    }
    if (
      chunk.type === 'VP8 ' &&
      chunk.data.length >= 10 &&
      chunk.data[3] === 0x9d && chunk.data[4] === 0x01 && chunk.data[5] === 0x2a
    ) {
      return {
        width: (chunk.data[6] | (chunk.data[7] << 8)) & 0x3fff,
        height: (chunk.data[8] | (chunk.data[9] << 8)) & 0x3fff,
      };
    }
    if (chunk.type === 'VP8L' && chunk.data.length >= 5 && chunk.data[0] === 0x2f) {
      const bits = readU32LE(chunk.data, 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

function buildWebpChunk(type, data) {
  const output = new Uint8Array(8 + data.length + (data.length % 2));
  output.set(encoder.encode(type), 0);
  writeU32LE(output, 4, data.length);
  output.set(data, 8);
  return output;
}

function concat(...parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readU24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readU32BE(bytes, offset) {
  return (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function readU32LE(bytes, offset) {
  return (bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + ((bytes[offset + 3] << 24) >>> 0)) >>> 0;
}

function writeU24LE(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
}

function writeU32BE(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function writeU32LE(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
