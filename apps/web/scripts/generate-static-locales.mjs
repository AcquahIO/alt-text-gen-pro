import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const distDir = path.join(appRoot, 'dist');
const localeDir = path.join(appRoot, 'src', 'i18n', 'locales');

const SUPPORTED_LOCALES = ['en-GB', 'en-US'];
const DEFAULT_LOCALE = 'en-GB';
const ROUTES = [
  { id: 'landing', path: '/', indexable: true },
  { id: 'app', path: '/app', indexable: false },
  { id: 'authCallback', path: '/app/auth/callback', indexable: false },
  { id: 'billingSuccess', path: '/app/billing/success', indexable: false },
  { id: 'billingCancel', path: '/app/billing/cancel', indexable: false },
];
const OG_LOCALE_MAP = {
  'en-GB': 'en_GB',
  'en-US': 'en_US',
};

const appOrigin = normalizeOrigin(process.env.VITE_APP_ORIGIN) ?? 'https://your-domain.com';
const isStaging = process.env.VITE_STAGING === 'true';
const channelLinks = {
  chrome: process.env.VITE_CHROME_LINK || '',
  shopify: process.env.VITE_SHOPIFY_LINK || '#shopify-waitlist',
  wordpress: process.env.VITE_WORDPRESS_LINK || '#wordpress-waitlist',
};

function normalizeOrigin(input) {
  if (!input) return null;
  try {
    return new URL(input).origin;
  } catch {
    return null;
  }
}

function readMessages(locale) {
  return JSON.parse(fs.readFileSync(path.join(localeDir, `${locale}.json`), 'utf8'));
}

const EN_GB = readMessages(DEFAULT_LOCALE);
const MESSAGES = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, readMessages(locale)]));

function getDirection(locale) {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getValue(dictionary, key) {
  return key.split('.').reduce((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[segment];
  }, dictionary);
}

function t(locale, key, params = {}) {
  const raw = getValue(MESSAGES[locale], key) ?? getValue(EN_GB, key);
  if (typeof raw !== 'string') return key;
  return raw.replace(/\{(\w+)\}/g, (_, token) => String(params[token] ?? `{${token}}`));
}

function localizedPath(locale, routePath) {
  if (routePath === '/') return `/${locale}/`;
  return `/${locale}${routePath}`;
}

function localizedUrl(locale, routePath) {
  return `${appOrigin}${localizedPath(locale, routePath)}`;
}

function channelLabel(locale, id, field) {
  return t(locale, `channels.${id}.${field}`);
}

function seoKey(routeId) {
  return routeId;
}

function structuredData(locale, route, title, description, canonicalUrl) {
  const brandName = t(locale, 'brand.name');
  if (route.id === 'landing') {
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: brandName,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: locale,
      url: canonicalUrl,
      description,
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '10',
        highPrice: '19',
        priceCurrency: 'USD',
        offerCount: 3,
      },
    };
  }

  if (route.id === 'app') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: title,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: locale,
      url: canonicalUrl,
      description,
      isPartOf: {
        '@type': 'WebSite',
        name: brandName,
        url: `${appOrigin}/en-GB/`,
      },
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    inLanguage: locale,
    url: canonicalUrl,
    description,
    isPartOf: {
      '@type': 'WebSite',
      name: brandName,
      url: `${appOrigin}/en-GB/`,
    },
  };
}

function renderLanding(locale) {
  const appHref = localizedPath(locale, '/app');
  const chromeHref = channelLinks.chrome || appHref;

  return `
      <header class="site-header landing-header">
        <div class="container header-inner">
          <a href="${escapeHtml(localizedPath(locale, '/'))}" class="brand">
            <span class="brand-mark">${escapeHtml(t(locale, 'brand.shortName'))}</span>
            <span class="brand-title">${escapeHtml(t(locale, 'brand.name'))}</span>
          </a>
          <div class="nav-actions">
            <a href="${escapeHtml(appHref)}" class="btn btn-primary">${escapeHtml(t(locale, 'landing.nav.startGenerating'))}</a>
          </div>
        </div>
      </header>
      <main>
        <section class="hero landing-hero">
          <img class="hero-image" src="/assets/seo-alt-text-hero.jpg" alt="Light oak dining chair against a warm studio background" width="1536" height="1024" />
          <div class="hero-scrim"></div>
          <div class="container hero-content">
            <div class="hero-copy">
              <span class="eyebrow">${escapeHtml(t(locale, 'brand.tagline'))}</span>
              <h1>${escapeHtml(t(locale, 'landing.hero.title'))}</h1>
              <p>${escapeHtml(t(locale, 'landing.hero.body'))}</p>
              <div class="hero-ctas">
                <a href="${escapeHtml(appHref)}" class="btn btn-primary btn-large">${escapeHtml(t(locale, 'landing.hero.launchWebApp'))}</a>
                <a href="${escapeHtml(chromeHref)}" class="btn btn-light btn-large">${escapeHtml(t(locale, 'channels.chrome.cta'))}</a>
              </div>
              <small class="hero-note">${escapeHtml(t(locale, 'landing.kpis.info'))}</small>
            </div>
            <div class="hero-result">
              <span>Generated example</span>
              <strong>Light oak dining chair with curved backrest in a warm studio setting</strong>
            </div>
          </div>
        </section>
        <section class="section proof-strip">
          <div class="container proof-grid">
            <div><strong>${escapeHtml(t(locale, 'landing.kpis.channelsTitle'))}</strong><span>${escapeHtml(t(locale, 'landing.kpis.channelsBody'))}</span></div>
            <div><strong>${escapeHtml(t(locale, 'landing.kpis.accountTitle'))}</strong><span>${escapeHtml(t(locale, 'landing.kpis.accountBody'))}</span></div>
            <div><strong>${escapeHtml(t(locale, 'landing.kpis.batchTitle'))}</strong><span>${escapeHtml(t(locale, 'landing.kpis.batchBody'))}</span></div>
          </div>
        </section>
        <section class="section workflow-section" id="workflow">
          <div class="container">
            <div class="section-heading">
              <span class="eyebrow">01 — ${escapeHtml(t(locale, 'landing.features.title'))}</span>
              <h2>${escapeHtml(t(locale, 'landing.features.subtitle'))}</h2>
            </div>
            <div class="workflow-list">
              <article><span>01</span>
                <h3>${escapeHtml(t(locale, 'landing.features.contextTitle'))}</h3>
                <p>${escapeHtml(t(locale, 'landing.features.contextBody'))}</p>
              </article>
              <article><span>02</span>
                <h3>${escapeHtml(t(locale, 'landing.features.subscriptionsTitle'))}</h3>
                <p>${escapeHtml(t(locale, 'landing.features.subscriptionsBody'))}</p>
              </article>
              <article><span>03</span>
                <h3>${escapeHtml(t(locale, 'landing.features.metadataTitle'))}</h3>
                <p>${escapeHtml(t(locale, 'landing.features.metadataBody'))}</p>
              </article>
            </div>
          </div>
        </section>
        <section class="section product-depth">
          <div class="container depth-grid">
            <div class="depth-copy">
              <span class="eyebrow">02 — ${escapeHtml(t(locale, 'landing.platforms.title'))}</span>
              <h2>${escapeHtml(t(locale, 'landing.platforms.subtitle'))}</h2>
              <p>${escapeHtml(channelLabel(locale, 'chrome', 'description'))}</p>
              <a class="text-link" href="${escapeHtml(chromeHref)}">${escapeHtml(channelLabel(locale, 'chrome', 'cta'))} ↗</a>
            </div>
          </div>
        </section>
        <section class="section pricing-section" id="pricing">
          <div class="container">
            <div class="section-heading"><span class="eyebrow">03 — ${escapeHtml(t(locale, 'landing.pricing.title'))}</span><h2>${escapeHtml(t(locale, 'landing.pricing.subtitle'))}</h2></div>
            <div class="pricing-lines">
              <article><div><h3>${escapeHtml(t(locale, 'landing.pricing.freeTitle'))}</h3><p>${escapeHtml(t(locale, 'landing.pricing.freeBody'))}</p></div>
                <strong>${escapeHtml(t(locale, 'landing.pricing.freePrice'))}</strong>
                <a href="${escapeHtml(appHref)}" class="btn btn-outline">${escapeHtml(t(locale, 'common.openApp'))}</a>
              </article>
              <article class="pricing-featured"><div><h3>${escapeHtml(t(locale, 'landing.pricing.singleTitle'))}</h3><p>${escapeHtml(t(locale, 'landing.pricing.singleBody'))}</p></div>
                <strong>${escapeHtml(t(locale, 'landing.pricing.singlePrice'))}</strong>
                <a href="${escapeHtml(appHref)}" class="btn btn-primary">${escapeHtml(t(locale, 'landing.pricing.choosePlan'))}</a>
              </article>
              <article><div><h3>${escapeHtml(t(locale, 'landing.pricing.allTitle'))}</h3><p>${escapeHtml(t(locale, 'landing.pricing.allBody'))}</p></div>
                <strong>${escapeHtml(t(locale, 'landing.pricing.allPrice'))}</strong>
                <a href="${escapeHtml(appHref)}" class="btn btn-outline">${escapeHtml(t(locale, 'landing.pricing.comparePlans'))}</a>
              </article>
            </div>
          </div>
        </section>
        <section class="final-cta"><div class="container final-cta-inner"><div><span class="eyebrow">${escapeHtml(t(locale, 'brand.name'))}</span><h2>${escapeHtml(t(locale, 'landing.hero.title'))}</h2></div><a href="${escapeHtml(appHref)}" class="btn btn-light btn-large">${escapeHtml(t(locale, 'landing.hero.launchWebApp'))}</a></div></section>
      </main>
      <footer class="footer landing-footer">
        <div class="container footer-inner"><div>${escapeHtml(t(locale, 'brand.footer'))}</div><nav><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="mailto:charles@acquah.io">Support</a></nav></div>
      </footer>
  `;
}

function renderApp(locale) {
  return `
      <header class="site-header">
        <div class="container header-inner">
          <a href="${escapeHtml(localizedPath(locale, '/'))}" class="brand">
            <span class="brand-mark">${escapeHtml(t(locale, 'brand.shortName'))}</span>
            <span class="brand-text">
              <span class="brand-title">${escapeHtml(t(locale, 'brand.name'))}</span>
              <span class="brand-sub">${escapeHtml(t(locale, 'brand.sharedTagline'))}</span>
            </span>
          </a>
        </div>
      </header>
      <main class="app-shell">
        <div class="container stack" style="gap:14px">
          <section class="panel stack">
            <h1>${escapeHtml(t(locale, 'app.accountHub'))}</h1>
            <p class="muted">${escapeHtml(t(locale, 'app.signInSharedAccount'))}</p>
          </section>
          <section class="panel stack">
            <h2>${escapeHtml(t(locale, 'app.plansTitle'))}</h2>
            <p class="muted">${escapeHtml(t(locale, 'app.plansSubtitle'))}</p>
          </section>
          <section class="panel stack">
            <h2>${escapeHtml(t(locale, 'app.generateTitle'))}</h2>
            <p class="muted">${escapeHtml(t(locale, 'app.noItems'))}</p>
          </section>
        </div>
      </main>
  `;
}

function renderCenterCard(locale, titleKey, bodyKey) {
  return `
      <div class="center-card">
        <h1 style="margin:0;font-family:'Space Grotesk',sans-serif">${escapeHtml(t(locale, titleKey))}</h1>
        <p class="muted" style="margin-top:12px">${escapeHtml(t(locale, bodyKey))}</p>
      </div>
  `;
}

function renderRouteMarkup(locale, route) {
  if (route.id === 'landing') return renderLanding(locale);
  if (route.id === 'app') return renderApp(locale);
  if (route.id === 'authCallback') return renderCenterCard(locale, 'auth.title', 'auth.body');
  if (route.id === 'billingSuccess') return renderCenterCard(locale, 'billing.successTitle', 'billing.successBody');
  return renderCenterCard(locale, 'billing.cancelTitle', 'billing.cancelBody');
}

function buildHeadExtras(locale, route) {
  const title = t(locale, `seo.${seoKey(route.id)}.title`);
  const description = t(locale, `seo.${seoKey(route.id)}.description`);
  const canonicalUrl = localizedUrl(locale, route.path);
  const robots = isStaging ? 'noindex,nofollow' : route.indexable ? 'index,follow' : 'noindex,follow';
  const jsonLd = JSON.stringify(structuredData(locale, route, title, description, canonicalUrl)).replace(/<\/script/gi, '<\\/script');

  return `
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${escapeHtml(robots)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    ${SUPPORTED_LOCALES.map(
      (entry) =>
        `<link rel="alternate" hreflang="${escapeHtml(entry)}" href="${escapeHtml(localizedUrl(entry, route.path))}" />`,
    ).join('\n    ')}
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(`${appOrigin}/en-GB/`)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(t(locale, 'seo.siteName'))}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:locale" content="${escapeHtml(OG_LOCALE_MAP[locale])}" />
    <meta property="og:image" content="${escapeHtml(`${appOrigin}/assets/seo-alt-text-hero.jpg`)}" />
    <meta property="og:image:alt" content="Light oak dining chair against a warm studio background" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />
    <meta name="twitter:image" content="${escapeHtml(`${appOrigin}/assets/seo-alt-text-hero.jpg`)}" />
    <script type="application/ld+json">${jsonLd}</script>
  `;
}

function composePage(template, locale, route) {
  const title = t(locale, `seo.${seoKey(route.id)}.title`);
  const headExtras = buildHeadExtras(locale, route);
  const htmlTag = `<html lang="${escapeHtml(locale)}" dir="${escapeHtml(getDirection(locale))}">`;

  return template
    .replace(/<html[^>]*>/, htmlTag)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description"[\s\S]*?\/>/, '')
    .replace('<div id="root"></div>', `<div id="root">${renderRouteMarkup(locale, route)}</div>`)
    .replace('</head>', `${headExtras}\n  </head>`);
}

function ensurePageWrite(relativePath, contents) {
  const outputPath = path.join(distDir, relativePath, 'index.html');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, contents);
}

function redirectScript(targetPath) {
  const normalizedTarget = targetPath === '/' ? '/' : targetPath;
  return `
<script>
(function () {
  var DEFAULT_LOCALE = 'en-GB';
  function normalizeLocale(input) {
    if (!input) return null;
    var value = String(input).trim().toLowerCase();
    if (value === 'en' || value === 'en-gb') return 'en-GB';
    if (value === 'en-us') return 'en-US';
    if (value === 'es' || value === 'es-es') return 'es-ES';
    if (value === 'fr' || value === 'fr-fr') return 'fr-FR';
    if (value === 'de' || value === 'de-de') return 'de-DE';
    if (value === 'ar' || value.indexOf('ar-') === 0) return 'ar';
    if (value === 'zh' || value === 'zh-cn' || value === 'zh-sg' || value === 'zh-hans') return 'zh-Hans';
    return null;
  }
  function getCookieLocale() {
    var match = document.cookie.match(/(?:^|;\\s*)lang_pref=([^;]+)/);
    return match ? normalizeLocale(decodeURIComponent(match[1])) : null;
  }
  function preferredLocale() {
    var fromCookie = getCookieLocale();
    if (fromCookie) return fromCookie;
    var languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (var i = 0; i < languages.length; i += 1) {
      var normalized = normalizeLocale(languages[i]);
      if (normalized) return normalized;
    }
    return DEFAULT_LOCALE;
  }
  var locale = preferredLocale();
  var path = ${JSON.stringify(normalizedTarget)};
  var target = path === '/' ? '/' + locale + '/' : '/' + locale + path;
  window.location.replace(target + window.location.search + window.location.hash);
}());
</script>`;
}

function redirectPage(targetPath) {
  const fallback = targetPath === '/' ? '/en-GB/' : `/en-GB${targetPath}`;
  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Redirecting…</title>
    <meta name="robots" content="noindex,nofollow" />
    <link rel="canonical" href="${escapeHtml(`${appOrigin}/en-GB/`)}" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(fallback)}" />
    ${redirectScript(targetPath)}
  </head>
  <body>
    <p>Redirecting…</p>
  </body>
</html>
`;
}

function buildSitemap() {
  const landingRoute = ROUTES.find((route) => route.id === 'landing');
  const entries = SUPPORTED_LOCALES.map((locale) => {
    const loc = localizedUrl(locale, landingRoute.path);
    const alternates = SUPPORTED_LOCALES.map(
      (alternateLocale) =>
        `    <xhtml:link rel="alternate" hreflang="${alternateLocale}" href="${escapeHtml(localizedUrl(alternateLocale, landingRoute.path))}" />`,
    ).join('\n');

    return `  <url>
    <loc>${escapeHtml(loc)}</loc>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(`${appOrigin}/en-GB/`)}" />
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`;
}

function buildRobots() {
  if (isStaging) {
    return `User-agent: *
Disallow: /

Sitemap: ${appOrigin}/sitemap.xml
`;
  }

  return `User-agent: *
Allow: /

Sitemap: ${appOrigin}/sitemap.xml
`;
}

const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

for (const locale of SUPPORTED_LOCALES) {
  for (const route of ROUTES) {
    const relativePath = localizedPath(locale, route.path).replace(/^\//, '').replace(/\/$/, '');
    ensurePageWrite(relativePath, composePage(template, locale, route));
  }
}

fs.writeFileSync(path.join(distDir, 'index.html'), redirectPage('/'));
ensurePageWrite('app', redirectPage('/app'));
ensurePageWrite(path.join('app', 'auth', 'callback'), redirectPage('/app/auth/callback'));
ensurePageWrite(path.join('app', 'billing', 'success'), redirectPage('/app/billing/success'));
ensurePageWrite(path.join('app', 'billing', 'cancel'), redirectPage('/app/billing/cancel'));
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), buildSitemap());
fs.writeFileSync(path.join(distDir, 'robots.txt'), buildRobots());
