import { QueueItem } from '@/lib/types';

export async function downloadWithMetadata(item: QueueItem, altText: string): Promise<void> {
  if (!item.dataUrl) {
    throw new Error('Download with metadata is only available for uploaded images.');
  }
  const arrayBuffer = dataUrlToArrayBuffer(item.dataUrl);
  const blob = await embedAltTextIntoImage(arrayBuffer, item.type || '', altText);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = item.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = String(dataUrl).split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.slice().buffer;
}

async function embedAltTextIntoImage(arrayBuffer: ArrayBuffer, mimeType: string, altText: string): Promise<Blob> {
  const bytes = new Uint8Array(arrayBuffer);
  if (/jpeg|jpg/i.test(mimeType) || isJpeg(bytes)) {
    return new Blob([toArrayBuffer(embedXmpIntoJpeg(bytes, altText))], { type: 'image/jpeg' });
  }
  if (/png/i.test(mimeType) || isPng(bytes)) {
    return new Blob([toArrayBuffer(embedTextIntoPng(bytes, 'Description', altText))], { type: 'image/png' });
  }
  return new Blob([toArrayBuffer(bytes)], { type: mimeType || 'application/octet-stream' });
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function embedXmpIntoJpeg(bytes: Uint8Array, altText: string): Uint8Array {
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return bytes;

  const header = strToBytes('http://ns.adobe.com/xap/1.0/\x00');
  const xmp = buildXmpPacket(altText);
  const len = header.length + xmp.length;

  const app1 = new Uint8Array(2 + 2 + len);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  const totalLen = len + 2;
  app1[2] = (totalLen >> 8) & 0xff;
  app1[3] = totalLen & 0xff;
  app1.set(header, 4);
  app1.set(xmp, 4 + header.length);

  const out = new Uint8Array(bytes.length + app1.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(app1, 2);
  out.set(bytes.subarray(2), 2 + app1.length);
  return out;
}

function buildXmpPacket(altText: string): Uint8Array {
  const escaped = altText.replace(/[<&>]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char] || char));
  const xml =
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n' +
    '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
    '    <rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
    '      <dc:description>\n' +
    '        <rdf:Alt>\n' +
    `          <rdf:li xml:lang="x-default">${escaped}</rdf:li>\n` +
    '        </rdf:Alt>\n' +
    '      </dc:description>\n' +
    '    </rdf:Description>\n' +
    '  </rdf:RDF>\n' +
    '</x:xmpmeta>\n' +
    '<?xpacket end="w"?>';
  return new TextEncoder().encode(xml);
}

function embedTextIntoPng(bytes: Uint8Array, keyword: string, text: string): Uint8Array {
  const IEND = 0x49454e44;
  const out = new Uint8Array(bytes.length + 12 + keyword.length + 1 + text.length);
  out.set(bytes.subarray(0, 8), 0);

  let inPos = 8;
  let outPos = 8;

  while (inPos < bytes.length) {
    const len = readU32(bytes, inPos);
    inPos += 4;
    const type = readU32(bytes, inPos);
    inPos += 4;

    if (type === IEND) {
      outPos = writeChunk(out, outPos, 'tEXt', buildTextData(keyword, text));
    }

    out.set(bytes.subarray(inPos - 8, inPos + len + 4), outPos);
    outPos += 8 + len + 4;
    inPos += len + 4;
  }

  return out.subarray(0, outPos);
}

function buildTextData(keyword: string, text: string): Uint8Array {
  const k = new TextEncoder().encode(keyword);
  const latin1 = toLatin1(text);
  const data = new Uint8Array(k.length + 1 + latin1.length);
  data.set(k, 0);
  data[k.length] = 0;
  data.set(latin1, k.length + 1);
  return data;
}

function toLatin1(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  return out;
}

function writeChunk(out: Uint8Array, pos: number, typeStr: string, data: Uint8Array): number {
  writeU32(out, pos, data.length);
  pos += 4;
  const type = strToBytes(typeStr);
  out.set(type, pos);
  pos += 4;
  out.set(data, pos);
  pos += data.length;
  writeU32(out, pos, crc32(new Uint8Array([...type, ...data])));
  return pos + 4;
}

function readU32(bytes: Uint8Array, pos: number): number {
  return (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
}

function writeU32(bytes: Uint8Array, pos: number, val: number): void {
  bytes[pos] = (val >>> 24) & 0xff;
  bytes[pos + 1] = (val >>> 16) & 0xff;
  bytes[pos + 2] = (val >>> 8) & 0xff;
  bytes[pos + 3] = val & 0xff;
}

function strToBytes(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 0xff;
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}
