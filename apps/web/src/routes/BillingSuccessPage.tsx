import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n/provider';
import { buildRoutePath } from '@/i18n/routes';
import { useSeo } from '@/lib/seo';

export function BillingSuccessPage() {
  const { locale, t } = useI18n();
  const navigate = useNavigate();

  useSeo('billingSuccess');

  useEffect(() => {
    navigate(`${buildRoutePath(locale, 'app')}?billing=success`, { replace: true });
  }, [locale, navigate]);

  return (
    <div className="center-card">
      <h1 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>{t('billing.successTitle')}</h1>
      <p className="muted" style={{ marginTop: 12 }}>
        {t('billing.successBody')}
      </p>
    </div>
  );
}
