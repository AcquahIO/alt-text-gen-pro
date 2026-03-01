import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthCallbackPage } from '@/routes/AuthCallbackPage';
import { BillingCancelPage } from '@/routes/BillingCancelPage';
import { BillingSuccessPage } from '@/routes/BillingSuccessPage';
import { LandingPage } from '@/routes/LandingPage';
import { AppPage } from '@/routes/AppPage';
import { buildLocalizedPath, detectPreferredLocale, setLocaleCookie } from '@/i18n/config';
import { LocaleLayout } from '@/i18n/provider';

function PreferredLocaleRedirect() {
  const location = useLocation();
  const locale = detectPreferredLocale({
    pathname: location.pathname,
    cookie: document.cookie,
    browserLanguages: navigator.languages ?? [navigator.language],
  });

  useEffect(() => {
    setLocaleCookie(locale);
  }, [locale]);

  return <Navigate to={`${buildLocalizedPath(locale, location.pathname)}${location.search}${location.hash}`} replace />;
}

function RedirectToLocaleHome() {
  const { locale } = useParams();
  return <Navigate to={locale ? `/${locale}/` : '/'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<PreferredLocaleRedirect />} />
      <Route path="/app" element={<PreferredLocaleRedirect />} />
      <Route path="/app/auth/callback" element={<PreferredLocaleRedirect />} />
      <Route path="/app/billing/success" element={<PreferredLocaleRedirect />} />
      <Route path="/app/billing/cancel" element={<PreferredLocaleRedirect />} />

      <Route path="/:locale" element={<LocaleLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="app" element={<AppPage />} />
        <Route path="app/auth/callback" element={<AuthCallbackPage />} />
        <Route path="app/billing/success" element={<BillingSuccessPage />} />
        <Route path="app/billing/cancel" element={<BillingCancelPage />} />
        <Route path="*" element={<RedirectToLocaleHome />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
