import assert from 'node:assert/strict';
import test from 'node:test';

import { embedAltTextMetadata } from '../utils/metadata.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

test('embeds UTF-8 alt text in JPEG XMP without changing the format', () => {
  const source = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const result = embedAltTextMetadata(source.buffer, 'image/jpeg', 'Café & cake');

  assert.equal(result.metadataEmbedded, true);
  assert.equal(result.outputFormat, 'image/jpeg');
  assert.deepEqual([...result.bytes.subarray(0, 2)], [0xff, 0xd8]);
  assert.match(decoder.decode(result.bytes), /Café &amp; cake/);
  assert.deepEqual([...result.bytes.subarray(-2)], [0xff, 0xd9]);
});

test('writes a Unicode PNG iTXt Description chunk before IEND', () => {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const source = join(signature, pngChunk('IEND', new Uint8Array()));
  const result = embedAltTextMetadata(source.buffer, 'image/png', 'Crème brûlée 🍮');

  assert.equal(result.metadataEmbedded, true);
  assert.equal(result.outputFormat, 'image/png');
  assert.ok(findSequence(result.bytes, encoder.encode('iTXt')) >= 0);
  assert.ok(findSequence(result.bytes, encoder.encode('Description')) >= 0);
  assert.ok(findSequence(result.bytes, encoder.encode('Crème brûlée 🍮')) >= 0);
  assert.ok(findSequence(result.bytes, encoder.encode('iTXt')) < findSequence(result.bytes, encoder.encode('IEND')));
});

test('adds a WebP XMP chunk and preserves its VP8X dimensions', () => {
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x10;
  vp8x[4] = 99;
  vp8x[7] = 49;
  const source = webp(webpChunk('VP8X', vp8x));
  const result = embedAltTextMetadata(source.buffer, 'image/webp', 'Product bottle');

  assert.equal(result.metadataEmbedded, true);
  assert.equal(result.outputFormat, 'image/webp');
  assert.equal(result.bytes[20] & 0x14, 0x14);
  assert.ok(findSequence(result.bytes, encoder.encode('XMP ')) >= 0);
  assert.ok(findSequence(result.bytes, encoder.encode('Product bottle')) >= 0);
});

test('returns an unsupported image unchanged with an explicit reason', () => {
  const source = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  const result = embedAltTextMetadata(source.buffer, 'image/gif', 'Animated logo');

  assert.equal(result.metadataEmbedded, false);
  assert.equal(result.originalFormat, 'image/gif');
  assert.equal(result.outputFormat, 'image/gif');
  assert.match(result.reason, /Unsupported image format/);
  assert.deepEqual(result.bytes, source);
});

function pngChunk(type, data) {
  const output = new Uint8Array(12 + data.length);
  writeU32BE(output, 0, data.length);
  output.set(encoder.encode(type), 4);
  output.set(data, 8);
  return output;
}

function webpChunk(type, data) {
  const output = new Uint8Array(8 + data.length + (data.length % 2));
  output.set(encoder.encode(type), 0);
  writeU32LE(output, 4, data.length);
  output.set(data, 8);
  return output;
}

function webp(...chunks) {
  const body = join(...chunks);
  const header = new Uint8Array(12);
  header.set(encoder.encode('RIFF'), 0);
  writeU32LE(header, 4, body.length + 4);
  header.set(encoder.encode('WEBP'), 8);
  return join(header, body);
}

function join(...parts) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function findSequence(haystack, needle) {
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    let matches = true;
    for (let inner = 0; inner < needle.length; inner += 1) {
      if (haystack[index + inner] !== needle[inner]) {
        matches = false;
        break;
      }
    }
    if (matches) return index;
  }
  return -1;
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
