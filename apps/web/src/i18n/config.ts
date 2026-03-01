export const SUPPORTED_LOCALES = ['en-GB', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'ar', 'zh-Hans'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en-GB';
export const LANG_COOKIE_NAME = 'lang_pref';
export const LOCALE_LABELS: Record<Locale, string> = {
  'en-GB': 'English (United Kingdom)',
  'en-US': 'English (United States)',
  'es-ES': 'Español (España)',
  'fr-FR': 'Français (France)',
  'de-DE': 'Deutsch (Deutschland)',
  ar: 'العربية',
  'zh-Hans': '简体中文',
};

const RTL_LOCALES = new Set<Locale>(['ar']);
const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);
const OG_LOCALE_MAP: Record<Locale, string> = {
  'en-GB': 'en_GB',
  'en-US': 'en_US',
  'es-ES': 'es_ES',
  'fr-FR': 'fr_FR',
  'de-DE': 'de_DE',
  ar: 'ar_AR',
  'zh-Hans': 'zh_CN',
};

export function isSupportedLocale(input: string | null | undefined): input is Locale {
  return Boolean(input && SUPPORTED_LOCALE_SET.has(input));
}

export function normalizeLocale(input: string | null | undefined): Locale | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (isSupportedLocale(raw as Locale)) return raw as Locale;

  const normalized = raw.toLowerCase();
  if (normalized === 'en' || normalized === 'en-gb') return 'en-GB';
  if (normalized === 'en-us') return 'en-US';
  if (normalized === 'es' || normalized === 'es-es') return 'es-ES';
  if (normalized === 'fr' || normalized === 'fr-fr') return 'fr-FR';
  if (normalized === 'de' || normalized === 'de-de') return 'de-DE';
  if (normalized === 'ar' || normalized.startsWith('ar-')) return 'ar';
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-sg' || normalized === 'zh-hans') {
    return 'zh-Hans';
  }
  return null;
}

export function getLocaleDirection(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export function detectLocaleFromPath(pathname: string): Locale | null {
  const match = /^\/([^/]+)(?:\/|$)/.exec(pathname);
  return normalizeLocale(match?.[1] ?? null);
}

export function stripLocalePrefix(pathname: string): string {
  const locale = detectLocaleFromPath(pathname);
  if (!locale) return pathname || '/';
  const stripped = pathname.replace(new RegExp(`^/${locale}`), '') || '/';
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

export function buildLocalizedPath(locale: Locale, pathname: string): string {
  const raw = stripLocalePrefix(pathname || '/');
  const normalized = raw === '/' ? '' : raw.replace(/\/+$/, '');
  return normalized ? `/${locale}${normalized}` : `/${locale}/`;
}

export function getLocaleCookie(cookieValue?: string): Locale | null {
  const source = String(cookieValue ?? '');
  if (!source) return null;
  const match = source.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return normalizeLocale(decodeURIComponent(match[1]));
}

export function setLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LANG_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function getLocaleFromBrowserLanguages(languages: readonly string[]): Locale {
  for (const language of languages) {
    const normalized = normalizeLocale(language);
    if (normalized) return normalized;
  }
  return DEFAULT_LOCALE;
}

export function detectPreferredLocale(options: {
  pathname: string;
  cookie?: string;
  browserLanguages?: readonly string[];
}): Locale {
  const cookieLocale = getLocaleCookie(options.cookie);
  if (cookieLocale) return cookieLocale;

  const pathLocale = detectLocaleFromPath(options.pathname);
  if (pathLocale) return pathLocale;

  return getLocaleFromBrowserLanguages(options.browserLanguages ?? []);
}

export function toLanguageTag(locale: Locale): string {
  return locale;
}

export function toOgLocale(locale: Locale): string {
  return OG_LOCALE_MAP[locale];
}
