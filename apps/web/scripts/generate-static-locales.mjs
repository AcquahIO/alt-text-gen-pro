import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const distDir = path.join(appRoot, 'dist');
const localeDir = path.join(appRoot, 'src', 'i18n', 'locales');
const productFacts = JSON.parse(fs.readFileSync(path.join(appRoot, 'src', 'content', 'productFacts.json'), 'utf8'));

const SUPPORTED_LOCALES = ['en-GB', 'en-US'];
const DEFAULT_LOCALE = 'en-GB';
const ROUTES = [
  { id: 'landing', path: '/' },
  { id: 'agentApi', path: '/api/' },
];
const OG_LOCALE_MAP = { 'en-GB': 'en_GB', 'en-US': 'en_US' };
const DEFAULT_CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/alt-text-generator-pro/gdijbieeagfndfaokkpbcekndoldmilp';

const appOrigin = requireProductionOrigin('VITE_APP_ORIGIN', process.env.VITE_APP_ORIGIN);
const agentApiOrigin = requireProductionOrigin(
  'VITE_AGENT_API_ORIGIN',
  process.env.VITE_AGENT_API_ORIGIN ?? 'https://alt-text-gen-pro-backend-4e3b4315d0d7.herokuapp.com',
);
const isStaging = process.env.VITE_STAGING === 'true';
const chromeHref = process.env.VITE_CHROME_LINK || DEFAULT_CHROME_STORE_URL;
const accessHref = 'mailto:charles@acquah.io?subject=Alt%20Text%20Generator%20Pro%20agent%20access';

function normalizeOrigin(input) {
  if (!input) return null;
  try {
    return new URL(input).origin;
  } catch {
    return null;
  }
}

function requireProductionOrigin(name, input) {
  const origin = normalizeOrigin(input);
  if (!origin || !origin.startsWith('https://') || /your-domain|example\.com/i.test(origin)) {
    throw new Error(`${name} must be a real HTTPS production origin.`);
  }
  return origin;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readMessages(locale) {
  return JSON.parse(fs.readFileSync(path.join(localeDir, `${locale}.json`), 'utf8'));
}

const MESSAGES = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, readMessages(locale)]));

function getValueAtPath(source, key) {
  return key.split('.').reduce((current, segment) => current?.[segment], source);
}

function t(locale, key) {
  return getValueAtPath(MESSAGES[locale], key) ?? getValueAtPath(MESSAGES[DEFAULT_LOCALE], key) ?? key;
}

function localizedPath(locale, routePath) {
  if (routePath === '/') return `/${locale}/`;
  return `/${locale}${routePath.replace(/\/+$/, '')}/`;
}

function localizedUrl(locale, routePath) {
  return `${appOrigin}${localizedPath(locale, routePath)}`;
}

function structuredData(locale, route, title, description, canonicalUrl) {
  const brandName = t(locale, 'brand.name');
  const organizationId = `${appOrigin}/#organization`;
  const websiteId = `${appOrigin}/#website`;
  const pageEntity = route.id === 'landing'
    ? {
        '@type': 'SoftwareApplication',
        '@id': `${canonicalUrl}#software`,
        name: brandName,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Google Chrome',
        inLanguage: locale,
        url: canonicalUrl,
        description,
        provider: { '@id': organizationId },
        isPartOf: { '@id': websiteId },
        offers: { '@type': 'Offer', price: '10', priceCurrency: 'USD' },
      }
    : {
        '@type': 'Service',
        '@id': `${canonicalUrl}#service`,
        name: title,
        serviceType: 'Metered alt text generation API and MCP service',
        inLanguage: locale,
        url: canonicalUrl,
        description,
        provider: { '@id': organizationId },
        isPartOf: { '@id': websiteId },
        areaServed: 'Worldwide',
      };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: brandName,
        url: localizedUrl(DEFAULT_LOCALE, '/'),
        logo: { '@type': 'ImageObject', url: `${appOrigin}/icon-512.png`, width: 512, height: 512 },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: brandName,
        url: localizedUrl(DEFAULT_LOCALE, '/'),
        publisher: { '@id': organizationId },
        inLanguage: SUPPORTED_LOCALES,
      },
      pageEntity,
    ],
  };
}

function renderBrand(locale) {
  return `<span class="atgp-brand"><img src="/favicon.png" alt="" width="36" height="36" /><span><strong>${escapeHtml(t(locale, 'brand.name'))}</strong><small>${escapeHtml(t(locale, 'brand.sharedTagline'))}</small></span></span>`;
}

function renderLanding(locale) {
  const homeHref = localizedPath(locale, '/');
  const apiHref = localizedPath(locale, '/api');
  return `
    <div class="atgp-site">
      <header class="atgp-header"><div class="container atgp-header-inner"><a href="${escapeHtml(homeHref)}">${renderBrand(locale)}</a><nav class="atgp-nav"><a href="#workflow">Features</a><a href="#pricing">Pricing</a><a href="${escapeHtml(apiHref)}">API / MCP</a></nav><a class="btn btn-primary atgp-header-cta" href="${escapeHtml(chromeHref)}">Add to Chrome</a></div></header>
      <main>
        <section class="atgp-hero"><div class="container atgp-hero-grid"><div class="atgp-hero-copy"><span class="atgp-kicker">SEO-aware alt text, right where you work</span><h1>Alt text, without leaving the page.</h1><p>${escapeHtml(productFacts.landingIntro)}</p><div class="atgp-hero-actions"><a class="btn btn-primary btn-large" href="${escapeHtml(chromeHref)}">Add to Chrome</a><a class="btn atgp-btn-secondary btn-large" href="${escapeHtml(apiHref)}">API / MCP for agents</a></div></div><figure class="atgp-workspace-showcase"><img src="/assets/extension-workspace-command.png" alt="Alt Text Generator Pro full-page Chrome extension workspace" /></figure></div></section>
        <section class="atgp-steps" id="workflow"><div class="container"><div class="atgp-section-heading"><span class="atgp-kicker">One complete Chrome product</span><h2>Popup speed. Full-page control.</h2><p>${escapeHtml(productFacts.chromeWorkflow)}</p></div><div class="atgp-step-grid"><article><span class="atgp-step-number">1</span><div><h3>Collect</h3><p>Scan visible page images or upload the files you want to describe.</p></div></article><article><span class="atgp-step-number">2</span><div><h3>Generate</h3><p>Add page, product, keyword, brand, and language context before generating concise descriptions.</p></div></article><article><span class="atgp-step-number">3</span><div><h3>Review</h3><p>Edit, regenerate, copy, or download every result before publishing it.</p></div></article></div></div></section>
        <section class="atgp-pricing-section" id="pricing"><div class="container atgp-pricing-layout"><div class="atgp-pricing-intro"><span class="atgp-kicker">Simple pricing</span><h2>Try it free for three days.</h2><p>${escapeHtml(productFacts.chromePricing)}</p><p class="atgp-agent-pricing-note">Building an automated workflow? <a href="${escapeHtml(apiHref)}">API and MCP access</a> is a separate, usage-based agent service.</p></div><div class="atgp-price-grid atgp-price-grid--single"><article class="atgp-price-card atgp-price-featured"><span class="atgp-best-value">Complete extension</span><h3>Chrome</h3><p>Quick generation on the page and a full workspace for batches.</p><strong>$10 <small>/ month</small></strong><ul><li>Three-day free trial</li><li>Popup + full-page workspace</li><li>Up to 5,000 successful generations monthly</li></ul><a href="${escapeHtml(chromeHref)}" class="btn btn-primary">Add to Chrome</a></article></div></div></section>
      </main>
      <footer class="atgp-footer"><div class="container atgp-footer-inner">${renderBrand(locale)}<nav><a href="${escapeHtml(apiHref)}">API / MCP</a></nav><nav><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="mailto:charles@acquah.io">Support</a></nav></div></footer>
    </div>`;
}

function renderAgentApi(locale) {
  const homeHref = localizedPath(locale, '/');
  return `
    <div class="atgp-site atgp-api-page">
      <header class="atgp-header"><div class="container atgp-header-inner"><a href="${escapeHtml(homeHref)}">${renderBrand(locale)}</a><nav class="atgp-nav"><a href="${escapeHtml(homeHref)}">Chrome product</a><a href="#connection">Connection</a><a href="#metering">Metering</a></nav><a class="btn btn-primary atgp-header-cta" href="${escapeHtml(accessHref)}">Request access</a></div></header>
      <main>
        <section class="atgp-api-hero"><div class="container atgp-api-hero-grid"><div class="atgp-api-copy"><span class="atgp-kicker">For agents and automated workflows</span><h1>Alt text infrastructure for agents.</h1><p>${escapeHtml(productFacts.agentIntro)}</p><div class="atgp-hero-actions"><a class="btn btn-primary btn-large" href="${escapeHtml(accessHref)}">Request agent access</a></div><p class="atgp-api-separation-note">${escapeHtml(productFacts.agentMetering)}</p></div><div class="atgp-api-response"><div class="atgp-api-response-head"><span>Illustrative response contract</span><code>generate_image_metadata</code></div><pre><code>{
  "original_format": "image/jpeg",
  "alt_text": "Oak dining chair with curved backrest in a warm studio",
  "status": "succeeded",
  "successful_operations": 1
}</code></pre></div></div></section>
        <section class="atgp-api-resources" aria-labelledby="static-developer-resources"><div class="container"><div class="atgp-api-heading"><span class="atgp-kicker">Developer resources</span><h2 id="static-developer-resources">Inspect the live contract before connecting.</h2><p>Public discovery describes the released transport, supported inputs, authentication model, and current limitations.</p></div><div class="atgp-api-resource-links"><a href="${appOrigin}/llms.txt">LLM guidance</a><a href="${appOrigin}/.well-known/mcp.json">MCP discovery</a><a href="${agentApiOrigin}/v1/openapi.json">OpenAPI document</a><a href="${agentApiOrigin}/mcp">MCP transport</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="${escapeHtml(accessHref)}">Request access</a></div></div></section>
        <section class="atgp-api-section" id="connection"><div class="container"><div class="atgp-api-heading"><span class="atgp-kicker">Connection model</span><h2>One clear path from image to result.</h2><p>${escapeHtml(productFacts.agentInput)} ${escapeHtml(productFacts.agentOutput)}</p></div><div class="atgp-api-tools"><div><span class="atgp-kicker">Initial tool surface</span><h3>Small enough for an agent to use correctly.</h3></div><dl><div><dt>generate_image_metadata</dt><dd>Generate one canonical alt-text result through a metered, idempotent operation.</dd></div><div><dt>usage_get_summary</dt><dd>Inspect successful units and request status counts for a selected time window.</dd></div><div><dt>generate_image_metadata_batch <em>Planned</em></dt><dd>Deferred until the single-image metering and ledger have been proven in production.</dd></div></dl></div></div></section>
        <section class="atgp-api-section atgp-api-metering" id="metering"><div class="container atgp-api-metering-grid"><div><span class="atgp-kicker">Usage-based agent service</span><h2>Meter the automation, not the person.</h2><p>${escapeHtml(productFacts.agentMetering)}</p><a class="btn btn-primary btn-large" href="${escapeHtml(accessHref)}">Request current rates and access</a></div><ul><li><span><strong>Separate entitlement</strong>Chrome access does not implicitly enable agent usage.</span></li><li><span><strong>Auditable usage</strong>Inspect summaries for the active metering window.</span></li><li><span><strong>Operational controls</strong>Rotate or revoke agent tokens independently.</span></li></ul></div></section>
      </main>
      <footer class="atgp-footer"><div class="container atgp-footer-inner"><a href="${escapeHtml(homeHref)}">${renderBrand(locale)}</a><nav><a href="${escapeHtml(homeHref)}">Chrome product</a></nav><nav><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="mailto:charles@acquah.io">Support</a></nav></div></footer>
    </div>`;
}

function buildHeadExtras(locale, route) {
  const title = t(locale, `seo.${route.id}.title`);
  const description = t(locale, `seo.${route.id}.description`);
  const canonicalUrl = localizedUrl(locale, route.path);
  const robots = isStaging ? 'noindex,nofollow' : 'index,follow';
  const jsonLd = JSON.stringify(structuredData(locale, route, title, description, canonicalUrl)).replace(/<\/script/gi, '<\\/script');
  return `
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    ${SUPPORTED_LOCALES.map((entry) => `<link rel="alternate" hreflang="${entry}" href="${escapeHtml(localizedUrl(entry, route.path))}" />`).join('\n    ')}
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(localizedUrl(DEFAULT_LOCALE, route.path))}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(t(locale, 'seo.siteName'))}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:locale" content="${OG_LOCALE_MAP[locale]}" />
    <meta property="og:image" content="${escapeHtml(`${appOrigin}/social-card.png`)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Alt Text Generator Pro for Chrome and agent workflows" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(`${appOrigin}/social-card.png`)}" />
    <meta name="twitter:image:alt" content="Alt Text Generator Pro for Chrome and agent workflows" />
    <script type="application/ld+json" data-seo-jsonld="true">${jsonLd}</script>`;
}

function composePage(template, locale, route) {
  const title = t(locale, `seo.${route.id}.title`);
  const markup = route.id === 'landing' ? renderLanding(locale) : renderAgentApi(locale);
  const page = template
    .replace(/<html[^>]*>/, `<html lang="${locale}" dir="ltr">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name=["']description["'][\s\S]*?>/i, '')
    .replace('<div id="root"></div>', `<div id="root">${markup}</div>`)
    .replace('</head>', `${buildHeadExtras(locale, route)}\n  </head>`);
  assertGeneratedPage(page, locale, route);
  return page;
}

function assertGeneratedPage(page, locale, route) {
  const checks = [
    ['description', (page.match(/<meta\s+name=["']description["']/gi) ?? []).length],
    ['canonical', (page.match(/<link\s+rel=["']canonical["']/gi) ?? []).length],
    ['H1', (page.match(/<h1(?:\s|>)/gi) ?? []).length],
    ['JSON-LD graph', (page.match(/type=["']application\/ld\+json["']/gi) ?? []).length],
  ];
  for (const [label, count] of checks) {
    if (count !== 1) throw new Error(`${locale} ${route.id} must contain exactly one ${label}; found ${count}.`);
  }
  if (/your-domain\.com/i.test(page)) throw new Error(`${locale} ${route.id} contains a placeholder origin.`);
}

function ensurePageWrite(relativePath, contents) {
  const outputPath = path.join(distDir, relativePath, 'index.html');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, contents);
}

function buildSitemap() {
  const entries = ROUTES.flatMap((route) => SUPPORTED_LOCALES.map((locale) => {
    const alternates = SUPPORTED_LOCALES.map((alternate) => `    <xhtml:link rel="alternate" hreflang="${alternate}" href="${escapeHtml(localizedUrl(alternate, route.path))}" />`).join('\n');
    return `  <url>\n    <loc>${escapeHtml(localizedUrl(locale, route.path))}</loc>\n${alternates}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(localizedUrl(DEFAULT_LOCALE, route.path))}" />\n  </url>`;
  })).join('\n');
  const legalEntries = ['/privacy/', '/terms/']
    .map((pathname) => `  <url>\n    <loc>${escapeHtml(`${appOrigin}${pathname}`)}</loc>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n${legalEntries}\n</urlset>\n`;
}

function buildRobots() {
  return `User-agent: *\n${isStaging ? 'Disallow: /' : 'Allow: /'}\n\nSitemap: ${appOrigin}/sitemap.xml\n`;
}

function buildLlmsText() {
  return `# Alt Text Generator Pro

Alt Text Generator Pro has two distinct products:
- Chrome extension for people: ${appOrigin}${localizedPath(DEFAULT_LOCALE, '/')}
- Separately entitled agent API and MCP service: ${appOrigin}${localizedPath(DEFAULT_LOCALE, '/api/')}

Current agent inputs and limits:
- ${productFacts.agentInput}
- ${productFacts.agentMetering}
- ${productFacts.agentOutput}

Developer resources:
- MCP discovery: ${appOrigin}/.well-known/mcp.json
- Streamable HTTP MCP transport: ${agentApiOrigin}/mcp
- OpenAPI 3.1 document: ${agentApiOrigin}/v1/openapi.json
- Backend-specific LLM guidance: ${agentApiOrigin}/llms.txt
- Request agent access: ${accessHref}

Product and policy resources:
- Chrome pricing and workflow: ${appOrigin}${localizedPath(DEFAULT_LOCALE, '/')}
- Privacy: ${appOrigin}/privacy/
- Terms: ${appOrigin}/terms/
- Support: mailto:charles@acquah.io

Release status: the Chrome extension is the human product. Agent access is provisioned separately. Agent public-image URL ingestion, batch generation, processed-image delivery, and live external usage billing are not advertised as released capabilities.
`;
}

function buildMcpDiscovery() {
  return {
    name: 'Alt Text Generator Pro Agent API',
    version: '1.0.0',
    endpoint: `${agentApiOrigin}/mcp`,
    transport: 'streamable-http',
    protocol_versions: ['2025-06-18', '2025-03-26'],
    authentication: {
      type: 'bearer',
      token_kind: 'opaque_agent_token',
      access: accessHref,
      clarification: 'Chrome JWTs and private backend integration keys are not agent credentials.',
    },
    documentation: `${appOrigin}${localizedPath(DEFAULT_LOCALE, '/api/')}`,
    openapi: `${agentApiOrigin}/v1/openapi.json`,
    llms: `${appOrigin}/llms.txt`,
    privacy: `${appOrigin}/privacy/`,
    terms: `${appOrigin}/terms/`,
    tools: ['generate_image_metadata', 'usage_get_summary'],
    current_input: 'supported typed image data URL',
    limitations: ['public image URL ingestion', 'batch generation', 'processed-image delivery', 'live external usage billing'],
  };
}

const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

for (const locale of SUPPORTED_LOCALES) {
  for (const route of ROUTES) {
    const relativePath = localizedPath(locale, route.path).replace(/^\//, '').replace(/\/$/, '');
    ensurePageWrite(relativePath, composePage(template, locale, route));
  }

}

fs.writeFileSync(path.join(distDir, 'sitemap.xml'), buildSitemap());
fs.writeFileSync(path.join(distDir, 'robots.txt'), buildRobots());
fs.writeFileSync(path.join(distDir, 'llms.txt'), buildLlmsText());
fs.mkdirSync(path.join(distDir, '.well-known'), { recursive: true });
fs.writeFileSync(path.join(distDir, '.well-known', 'mcp.json'), `${JSON.stringify(buildMcpDiscovery(), null, 2)}\n`);
