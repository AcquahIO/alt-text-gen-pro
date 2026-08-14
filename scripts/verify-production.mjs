#!/usr/bin/env node

const apiBase = normalizeBase(process.env.API_BASE_URL);
const webBase = normalizeBase(process.env.WEB_BASE_URL);

if (!apiBase || !webBase) {
  console.error('Set API_BASE_URL and WEB_BASE_URL to the deployed HTTPS origins.');
  process.exit(2);
}

function normalizeBase(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    const localHttpAllowed =
      process.env.ALLOW_HTTP_LOCALHOST === 'true' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !localHttpAllowed) return '';
    return url.origin;
  } catch {
    return '';
  }
}

async function check(path, options = {}) {
  const url = new URL(path, options.base ?? apiBase);
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
    headers: options.headers,
  });
  const body = await response.text();
  const expectedStatus = options.status ?? 200;

  if (response.status !== expectedStatus) {
    throw new Error(`${url} returned ${response.status}; expected ${expectedStatus}`);
  }
  if (options.contentType && !response.headers.get('content-type')?.includes(options.contentType)) {
    throw new Error(`${url} returned the wrong content type`);
  }
  if (options.includes && !body.includes(options.includes)) {
    throw new Error(`${url} did not include the expected content`);
  }

  console.log(`PASS ${response.status} ${url}`);
}

await check('/healthz', { contentType: 'application/json', includes: '"ok":true' });
await check('/readyz', { contentType: 'application/json', includes: '"ok":true' });
await check('/privacy', { contentType: 'text/html', includes: 'Privacy, in plain language.' });
await check('/terms', { contentType: 'text/html', includes: 'Terms built for a useful product.' });
await check('/api/subscription-status', { status: 401, contentType: 'application/json' });
await check('/en-GB/', { base: webBase, contentType: 'text/html', includes: 'Alt Text Generator Pro' });
await check('/en-GB/app', { base: webBase, contentType: 'text/html', includes: 'Alt Text Generator Pro' });
await check('/robots.txt', { base: webBase, contentType: 'text/plain', includes: 'Sitemap:' });
await check('/sitemap.xml', { base: webBase, contentType: 'xml', includes: '<urlset' });

console.log('Production smoke checks passed.');
