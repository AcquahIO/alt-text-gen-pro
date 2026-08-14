import enGB from '@/i18n/locales/en-GB.json';
import enUS from '@/i18n/locales/en-US.json';
import { Locale } from '@/i18n/config';

export type TranslationDictionary = typeof enGB;

export const MESSAGES: Record<Locale, TranslationDictionary> = {
  'en-GB': enGB,
  'en-US': enUS,
};

export function getMessages(locale: Locale): TranslationDictionary {
  return MESSAGES[locale];
}
