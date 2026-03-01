import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeSignInFromCallback, consumePostAuthPath } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/env';
import { useI18n } from '@/i18n/provider';
import { buildRoutePath } from '@/i18n/routes';
import { useSeo } from '@/lib/seo';

export function AuthCallbackPage() {
  const { locale, t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useSeo('authCallback');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || '';
    const state = params.get('state');

    completeSignInFromCallback(API_BASE_URL, code, state)
      .then(() => {
        navigate(consumePostAuthPath() ?? buildRoutePath(locale, 'app'), { replace: true });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [locale, navigate]);

  return (
    <div className="center-card">
      <h1 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>{t('auth.title')}</h1>
      <p className="muted" style={{ marginTop: 12 }}>
        {t('auth.body')}
      </p>
      {error ? (
        <div className="notice notice-error" style={{ marginTop: 14 }}>
          {error}
        </div>
      ) : null}
      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-outline" onClick={() => navigate(buildRoutePath(locale, 'app'))}>
          {t('common.returnToApp')}
        </button>
      </div>
    </div>
  );
}
