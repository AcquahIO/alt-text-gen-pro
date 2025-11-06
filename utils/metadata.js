// utils/metadata.js
// Embed alt text into images for download: JPEG via XMP (APP1) and PNG via tEXt chunk.

export async function embedAltTextIntoImage(arrayBuffer, mimeType, altText) {
  const bytes = new Uint8Array(arrayBuffer);
  if (/jpeg|jpg/i.test(mimeType) || isJpeg(bytes)) {
    const out = embedXmpIntoJpeg(bytes, altText);
    return new Blob([out], { type: 'image/jpeg' });
  }
  if (/png/i.test(mimeType) || isPng(bytes)) {
    const out = embedTextIntoPng(bytes, 'Description', altText);
    return new Blob([out], { type: 'image/png' });
  }
  // Fallback: return original
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

function isJpeg(bytes) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}
function isPng(bytes) {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  );
}

// JPEG XMP APP1 injector: inserts after SOI marker
function embedXmpIntoJpeg(bytes, altText) {
  const header = strToBytes('http://ns.adobe.com/xap/1.0/\x00');
  const xmp = buildXmpPacket(altText);
  const len = header.length + xmp.length;
  // APP1 marker (FFE1), 2-byte length includes the length bytes themselves
  const app1 = new Uint8Array(2 + 2 + len);
  app1[0] = 0xff; app1[1] = 0xe1;
  const totalLen = len + 2; // include the two length bytes
  app1[2] = (totalLen >> 8) & 0xff; app1[3] = totalLen & 0xff;
  app1.set(header, 4);
  app1.set(xmp, 4 + header.length);

  // Insert after SOI (FFD8)
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return bytes;
  const out = new Uint8Array(bytes.length + app1.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(app1, 2);
  out.set(bytes.subarray(2), 2 + app1.length);
  return out;
}

function buildXmpPacket(altText) {
  const escaped = altText.replace(/[<&>]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
  const xml = `<?xpacket begin=\"\uFEFF\" id=\"W5M0MpCehiHzreSzNTczkc9d\"?>\n` +
`<x:xmpmeta xmlns:x=\"adobe:ns:meta/\">\n` +
`  <rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n` +
`    <rdf:Description xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n` +
`      <dc:description>\n` +
`        <rdf:Alt>\n` +
`          <rdf:li xml:lang=\"x-default\">${escaped}</rdf:li>\n` +
`        </rdf:Alt>\n` +
`      </dc:description>\n` +
`    </rdf:Description>\n` +
`  </rdf:RDF>\n` +
`</x:xmpmeta>\n` +
`<?xpacket end=\"w\"?>`;
  return new TextEncoder().encode(xml);
}

// PNG tEXt chunk injector: insert before IEND
function embedTextIntoPng(bytes, keyword, text) {
  const IEND = 0x49454e44; // 'IEND'
  const out = new Uint8Array(bytes.length + 12 + keyword.length + 1 + text.length);
  // copy signature
  out.set(bytes.subarray(0, 8), 0);
  let inPos = 8, outPos = 8;
  while (inPos < bytes.length) {
    const len = readU32(bytes, inPos); inPos += 4;
    const type = readU32(bytes, inPos); inPos += 4;
    if (type === IEND) {
      // insert tEXt before IEND
      const data = buildTextData(keyword, text);
      outPos = writeChunk(out, outPos, 'tEXt', data);
    }
    // copy current chunk
    out.set(bytes.subarray(inPos - 8, inPos + len + 4), outPos);
    outPos += 8 + len + 4;
    inPos += len + 4;
  }
  return out.subarray(0, outPos);
}

function buildTextData(keyword, text) {
  const k = new TextEncoder().encode(keyword);
  const sep = new Uint8Array([0]);
  // tEXt must be Latin-1; best-effort
  const latin1 = toLatin1(text);
  const data = new Uint8Array(k.length + 1 + latin1.length);
  data.set(k, 0);
  data.set(sep, k.length);
  data.set(latin1, k.length + 1);
  return data;
}

function toLatin1(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  return out;
}

function writeChunk(out, pos, typeStr, data) {
  writeU32(out, pos, data.length); pos += 4;
  const type = strToBytes(typeStr);
  out.set(type, pos); pos += 4;
  out.set(data, pos); pos += data.length;
  const crc = crc32(new Uint8Array([...type, ...data]));
  writeU32(out, pos, crc); pos += 4;
  return pos;
}

function readU32(bytes, pos) {
  return (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | (bytes[pos + 3]);
}
function writeU32(bytes, pos, val) {
  bytes[pos] = (val >>> 24) & 0xff;
  bytes[pos + 1] = (val >>> 16) & 0xff;
  bytes[pos + 2] = (val >>> 8) & 0xff;
  bytes[pos + 3] = val & 0xff;
}

function strToBytes(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

// CRC-32 (IEEE 802.3) for PNG chunks
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

