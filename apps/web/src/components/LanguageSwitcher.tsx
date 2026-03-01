import { ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildLocalizedPath, LOCALE_LABELS, Locale, setLocaleCookie, SUPPORTED_LOCALES } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale;
    setLocaleCookie(nextLocale);
    navigate(`${buildLocalizedPath(nextLocale, location.pathname)}${location.search}${location.hash}`);
  }

  return (
    <label className="language-switcher">
      <span className="visually-hidden">{t('languageSwitcher.label')}</span>
      <select className="select locale-select" value={locale} onChange={onChange} aria-label={t('languageSwitcher.label')}>
        {SUPPORTED_LOCALES.map((entry) => (
          <option key={entry} value={entry}>
            {LOCALE_LABELS[entry]}
          </option>
        ))}
      </select>
    </label>
  );
}
