import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { buildLocalizedPath, getLocaleDirection, Locale, normalizeLocale, setLocaleCookie } from '@/i18n/config';
import { getMessages, TranslationDictionary } from '@/i18n/messages';

interface TranslationParams {
  [key: string]: string | number;
}

interface I18nContextValue {
  locale: Locale;
  direction: 'ltr' | 'rtl';
  messages: TranslationDictionary;
  t: (key: string, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getValueAtPath(source: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token) => String(params[token] ?? `{${token}}`));
}

export function translate(locale: Locale, key: string, params?: TranslationParams): string {
  const dictionary = getMessages(locale);
  const fallback = getMessages('en-GB');
  const raw = getValueAtPath(dictionary, key) ?? getValueAtPath(fallback, key);
  if (typeof raw !== 'string') return key;
  return interpolate(raw, params);
}

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const direction = getLocaleDirection(locale);
  const messages = useMemo(() => getMessages(locale), [locale]);
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction,
      messages,
      t: (key, params) => translate(locale, key, params),
    }),
    [direction, locale, messages],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    setLocaleCookie(locale);
  }, [direction, locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider.');
  }
  return context;
}

export function LocaleLayout() {
  const { locale: routeLocale } = useParams();
  const location = useLocation();
  const locale = normalizeLocale(routeLocale);

  if (!locale) {
    return <Navigate to={buildLocalizedPath('en-GB', location.pathname)} replace />;
  }

  return (
    <I18nProvider locale={locale}>
      <Outlet />
    </I18nProvider>
  );
}
