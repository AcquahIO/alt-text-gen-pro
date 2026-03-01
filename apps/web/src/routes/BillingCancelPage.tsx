import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n/provider';
import { buildRoutePath } from '@/i18n/routes';
import { useSeo } from '@/lib/seo';

export function BillingCancelPage() {
  const { locale, t } = useI18n();
  const navigate = useNavigate();

  useSeo('billingCancel');

  useEffect(() => {
    navigate(`${buildRoutePath(locale, 'app')}?billing=cancel`, { replace: true });
  }, [locale, navigate]);

  return (
    <div className="center-card">
      <h1 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>{t('billing.cancelTitle')}</h1>
      <p className="muted" style={{ marginTop: 12 }}>
        {t('billing.cancelBody')}
      </p>
    </div>
  );
}
