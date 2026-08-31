import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const routeFiles = [
  ['en-GB/index.html', '/en-GB/'],
  ['en-US/index.html', '/en-US/'],
  ['en-GB/api/index.html', '/en-GB/api/'],
  ['en-US/api/index.html', '/en-US/api/'],
];

function read(relativePath) {
  return fs.readFileSync(path.join(dist, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(source, expression) {
  return source.match(expression)?.length ?? 0;
}

const firstPage = read(routeFiles[0][0]);
const firstCanonical = firstPage.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)/i)?.[1];
assert(firstCanonical, 'Unable to determine the generated canonical origin');
const siteOrigin = new URL(firstCanonical).origin;
assert(siteOrigin.startsWith('https://') && !/your-domain|example\.com/i.test(siteOrigin), 'Invalid generated site origin');

const expectedPages = routeFiles.map(([relativePath, pathname]) => [relativePath, `${siteOrigin}${pathname}`]);

for (const [relativePath, canonical] of expectedPages) {
  const html = read(relativePath);
  assert(count(html, /<title(?:\s|>)/gi) === 1, `${relativePath}: expected one title`);
  assert(count(html, /<meta\s+name=["']description["']/gi) === 1, `${relativePath}: expected one description`);
  assert(count(html, /<link\s+rel=["']canonical["']/gi) === 1, `${relativePath}: expected one canonical`);
  assert(count(html, /<h1(?:\s|>)/gi) === 1, `${relativePath}: expected one H1`);
  assert(count(html, /type=["']application\/ld\+json["']/gi) === 1, `${relativePath}: expected one JSON-LD graph`);
  assert(html.includes(`rel="canonical" href="${canonical}"`), `${relativePath}: canonical URL is not slash-consistent`);
  assert(!/your-domain\.com|example\.com/i.test(html), `${relativePath}: placeholder origin found`);
  assert(!/submit one public image URL/i.test(html), `${relativePath}: stale public-image input claim found`);

  const jsonLdText = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  assert(jsonLdText, `${relativePath}: JSON-LD payload missing`);
  const jsonLd = JSON.parse(jsonLdText);
  assert(Array.isArray(jsonLd['@graph']) && jsonLd['@graph'].length === 3, `${relativePath}: invalid JSON-LD graph`);
}

const sitemap = read('sitemap.xml');
for (const url of [...expectedPages.map(([, canonical]) => canonical), `${siteOrigin}/privacy/`, `${siteOrigin}/terms/`]) {
  assert(sitemap.includes(`<loc>${url}</loc>`), `sitemap.xml: missing ${url}`);
}

const llms = read('llms.txt');
assert(llms.includes(`${siteOrigin}/.well-known/mcp.json`), 'llms.txt: MCP discovery link missing');
assert(/https:\/\/[^\s]+\/v1\/openapi\.json/.test(llms), 'llms.txt: OpenAPI link missing');
assert(!/your-domain\.com|local foundation|process-local/i.test(llms), 'llms.txt: stale or placeholder copy found');

const mcp = JSON.parse(read('.well-known/mcp.json'));
assert(new URL(mcp.endpoint).protocol === 'https:', 'mcp.json: endpoint must be an absolute HTTPS URL');
assert(mcp.transport === 'streamable-http', 'mcp.json: transport must be streamable-http');
assert(Array.isArray(mcp.tools) && mcp.tools.includes('generate_image_metadata'), 'mcp.json: tool list is incomplete');

const socialCard = path.join(dist, 'social-card.png');
assert(fs.statSync(socialCard).size > 10_000, 'social-card.png: missing or unexpectedly small');

console.log(`SEO output verified: ${expectedPages.length} localized pages, sitemap, llms.txt, MCP discovery, and social card.`);
