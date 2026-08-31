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

  return { body, response, url };
}

async function checkWebAssets(pagePath) {
  const { body } = await check(pagePath, {
    base: webBase,
    contentType: 'text/html',
    includes: 'Alt Text Generator Pro',
    headers: { 'cache-control': 'no-cache' },
  });
  const assetPaths = [...body.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(
    ([, path]) => path,
  );

  if (assetPaths.length === 0) {
    throw new Error(`${new URL(pagePath, webBase)} did not reference any build assets`);
  }

  const canonicalCount = (body.match(/<link\s+rel=["']canonical["']/gi) ?? []).length;
  const descriptionCount = (body.match(/<meta\s+name=["']description["']/gi) ?? []).length;
  const jsonLdCount = (body.match(/type=["']application\/ld\+json["']/gi) ?? []).length;
  const h1Count = (body.match(/<h1(?:\s|>)/gi) ?? []).length;
  if (canonicalCount !== 1 || descriptionCount !== 1 || jsonLdCount !== 1 || h1Count !== 1) {
    throw new Error(`${new URL(pagePath, webBase)} has invalid SEO cardinality (canonical=${canonicalCount}, description=${descriptionCount}, jsonLd=${jsonLdCount}, h1=${h1Count})`);
  }
  if (/your-domain\.com/i.test(body)) {
    throw new Error(`${new URL(pagePath, webBase)} contains a placeholder domain`);
  }

  for (const assetPath of new Set(assetPaths)) {
    const expectedType = expectedAssetContentType(assetPath);
    await check(assetPath, { base: webBase, contentType: expectedType });
  }
}

function expectedAssetContentType(assetPath) {
  const pathname = new URL(assetPath, webBase).pathname.toLowerCase();
  if (pathname.endsWith('.css')) return 'text/css';
  if (pathname.endsWith('.js')) return 'javascript';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.avif')) return 'image/avif';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  if (pathname.endsWith('.woff2')) return 'font/woff2';
  throw new Error(`No expected content type configured for ${assetPath}`);
}

await check('/healthz', { contentType: 'application/json', includes: '"ok":true' });
await check('/readyz', { contentType: 'application/json', includes: '"ok":true' });
await check('/privacy', { contentType: 'text/html', includes: 'Privacy, in plain language.' });
await check('/terms', { contentType: 'text/html', includes: 'Terms built for a useful product.' });
await check('/api/subscription-status', { status: 401, contentType: 'application/json' });
await checkWebAssets('/en-GB/');
await checkWebAssets('/en-US/');
await checkWebAssets('/en-GB/api/');
await check('/en-GB/app', { base: webBase, contentType: 'text/html', includes: 'Alt Text Generator Pro' });
await check('/assets/production-smoke-missing.js', { base: webBase, status: 404 });
await check('/this-page-does-not-exist', { base: webBase, status: 404 });
await check('/robots.txt', { base: webBase, contentType: 'text/plain', includes: 'Sitemap:' });
await check('/sitemap.xml', { base: webBase, contentType: 'xml', includes: '<urlset' });
await check('/llms.txt', { base: webBase, contentType: 'text/plain', includes: '# Alt Text Generator Pro' });
await check('/.well-known/mcp.json', { base: webBase, contentType: 'application/json', includes: 'streamable-http' });
await check('/v1/openapi.json', { contentType: 'application/json', includes: '"openapi"' });
const mcp = await check('/mcp', { status: 401, contentType: 'application/json', includes: 'agent_token' });
if (!mcp.response.headers.get('www-authenticate')?.startsWith('Bearer ')) {
  throw new Error('MCP unauthenticated response must include a Bearer challenge');
}

console.log('Production smoke checks passed.');
