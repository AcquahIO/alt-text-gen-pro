import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AgentApiPage } from '@/routes/AgentApiPage';
import { LandingPage } from '@/routes/LandingPage';
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

function PreferredLocaleHomeRedirect() {
  const location = useLocation();
  const locale = detectPreferredLocale({
    pathname: location.pathname,
    cookie: document.cookie,
    browserLanguages: navigator.languages ?? [navigator.language],
  });

  useEffect(() => {
    setLocaleCookie(locale);
  }, [locale]);

  return <Navigate to={buildLocalizedPath(locale, '/')} replace />;
}

function RedirectToLocaleApi() {
  const { locale } = useParams();
  return <Navigate to={locale ? `/${locale}/api/` : '/api/'} replace />;
}

function RedirectToLocaleHome() {
  const { locale } = useParams();
  return <Navigate to={locale ? `/${locale}/` : '/'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<PreferredLocaleRedirect />} />
      <Route path="/api" element={<PreferredLocaleRedirect />} />
      <Route path="/mcp" element={<PreferredLocaleRedirect />} />
      <Route path="/app/*" element={<PreferredLocaleHomeRedirect />} />

      <Route path="/:locale" element={<LocaleLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="api" element={<AgentApiPage />} />
        <Route path="mcp" element={<RedirectToLocaleApi />} />
        <Route path="app/*" element={<RedirectToLocaleHome />} />
        <Route path="*" element={<RedirectToLocaleHome />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
