import enGB from '@/i18n/locales/en-GB.json';
import enUS from '@/i18n/locales/en-US.json';
import esES from '@/i18n/locales/es-ES.json';
import frFR from '@/i18n/locales/fr-FR.json';
import deDE from '@/i18n/locales/de-DE.json';
import ar from '@/i18n/locales/ar.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import { Locale } from '@/i18n/config';

export type TranslationDictionary = typeof enGB;

export const MESSAGES: Record<Locale, TranslationDictionary> = {
  'en-GB': enGB,
  'en-US': enUS,
  'es-ES': esES,
  'fr-FR': frFR,
  'de-DE': deDE,
  ar,
  'zh-Hans': zhHans,
};

export function getMessages(locale: Locale): TranslationDictionary {
  return MESSAGES[locale];
}
