import { useEffect } from 'react';
import { DEFAULT_LOCALE, Locale, SUPPORTED_LOCALES, toLanguageTag, toOgLocale } from '@/i18n/config';
import { buildRoutePath, isIndexableRoute, RouteId } from '@/i18n/routes';
import { useI18n } from '@/i18n/provider';
import { APP_ORIGIN, IS_STAGING } from '@/lib/env';

interface SeoPayload {
  title: string;
  description: string;
  canonicalUrl: string;
  noindex: boolean;
  jsonLd: Record<string, unknown>;
}

function upsertMeta(attribute: 'name' | 'property', value: string, content: string): void {
  let meta = document.head.querySelector(`meta[${attribute}="${value}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, value);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, hreflang?: string): void {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let link = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    if (hreflang) link.hreflang = hreflang;
    document.head.appendChild(link);
  }
  link.href = href;
}

function upsertJsonLd(payload: Record<string, unknown>): void {
  let script = document.head.querySelector('script[data-seo-jsonld="true"]') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.seoJsonld = 'true';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

function createStructuredData(
  routeId: RouteId,
  locale: Locale,
  url: string,
  title: string,
  description: string,
  brandName: string,
) {
  if (routeId === 'landing') {
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: brandName,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: locale,
      url,
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

  if (routeId === 'app') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: title,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: locale,
      url,
      description,
      isPartOf: {
        '@type': 'WebSite',
        name: brandName,
        url: `${APP_ORIGIN}${buildRoutePath(DEFAULT_LOCALE, 'landing')}`,
      },
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    inLanguage: locale,
    url,
    description,
    isPartOf: {
      '@type': 'WebSite',
      name: brandName,
      url: `${APP_ORIGIN}${buildRoutePath(DEFAULT_LOCALE, 'landing')}`,
    },
  };
}

function getSeoPayload(
  routeId: RouteId,
  locale: Locale,
  t: (key: string, params?: Record<string, string | number>) => string,
  brandName: string,
): SeoPayload {
  const seoKeyMap: Record<RouteId, string> = {
    landing: 'landing',
    app: 'app',
    authCallback: 'authCallback',
    billingSuccess: 'billingSuccess',
    billingCancel: 'billingCancel',
  };
  const key = seoKeyMap[routeId];
  const title = t(`seo.${key}.title`);
  const description = t(`seo.${key}.description`);
  const canonicalUrl = `${APP_ORIGIN}${buildRoutePath(locale, routeId)}`;
  const noindex = IS_STAGING || !isIndexableRoute(routeId);

  return {
    title,
    description,
    canonicalUrl,
    noindex,
    jsonLd: createStructuredData(routeId, locale, canonicalUrl, title, description, brandName),
  };
}

export function useSeo(routeId: RouteId): void {
  const { locale, t } = useI18n();

  useEffect(() => {
    const brandName = t('brand.name');
    const siteName = t('seo.siteName');
    const payload = getSeoPayload(routeId, locale, t, brandName);

    document.title = payload.title;
    upsertMeta('name', 'description', payload.description);
    upsertMeta('name', 'robots', payload.noindex ? (IS_STAGING ? 'noindex,nofollow' : 'noindex,follow') : 'index,follow');
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', siteName);
    upsertMeta('property', 'og:title', payload.title);
    upsertMeta('property', 'og:description', payload.description);
    upsertMeta('property', 'og:url', payload.canonicalUrl);
    upsertMeta('property', 'og:locale', toOgLocale(locale));
    const socialImage = `${APP_ORIGIN}/assets/seo-alt-text-hero.jpg`;
    upsertMeta('property', 'og:image', socialImage);
    upsertMeta('property', 'og:image:alt', 'Light oak dining chair against a warm studio background');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', payload.title);
    upsertMeta('name', 'twitter:description', payload.description);
    upsertMeta('name', 'twitter:url', payload.canonicalUrl);
    upsertMeta('name', 'twitter:image', socialImage);
    upsertLink('canonical', payload.canonicalUrl);

    for (const altLocale of SUPPORTED_LOCALES) {
      upsertLink('alternate', `${APP_ORIGIN}${buildRoutePath(altLocale, routeId)}`, toLanguageTag(altLocale));
    }
    upsertLink('alternate', `${APP_ORIGIN}${buildRoutePath(DEFAULT_LOCALE, 'landing')}`, 'x-default');
    upsertJsonLd(payload.jsonLd);
  }, [locale, routeId, t]);
}
