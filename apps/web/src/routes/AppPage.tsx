import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { createCheckoutSession, createPortalSession, generateAltText } from '@/lib/api';
import { addRecentItem, clearRecentItems, readRecentItems } from '@/lib/history';
import { downloadWithMetadata } from '@/lib/metadata';
import { useSeo } from '@/lib/seo';
import { useSession } from '@/lib/session';
import { BillingCatalogEntry, PlanCode, QueueItem, RecentItem } from '@/lib/types';
import { createUrlQueueItem, filesToQueueItems, formatFileSize } from '@/lib/uploads';
import { useI18n } from '@/i18n/provider';
import { buildRoutePath } from '@/i18n/routes';

const OUTPUT_LANGUAGES = [
  { value: '', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'ko', label: '한국어' },
  { value: 'ar', label: 'العربية' },
  { value: 'hi', label: 'हिन्दी' },
] as const;

const DEFAULT_CATALOG: BillingCatalogEntry[] = [
  {
    planCode: 'plan_web',
    title: 'Web',
    scope: 'web',
    unlockedScopes: ['web'],
    purchaseEnabled: true,
    current: false,
  },
  {
    planCode: 'plan_chrome',
    title: 'Chrome Extension',
    scope: 'chrome',
    unlockedScopes: ['chrome'],
    purchaseEnabled: true,
    current: false,
  },
  {
    planCode: 'plan_shopify',
    title: 'Shopify',
    scope: 'shopify',
    unlockedScopes: ['shopify'],
    purchaseEnabled: false,
    current: false,
  },
  {
    planCode: 'plan_wordpress',
    title: 'WordPress',
    scope: 'wordpress',
    unlockedScopes: ['wordpress'],
    purchaseEnabled: false,
    current: false,
  },
  {
    planCode: 'plan_all_access',
    title: 'All Access',
    scope: 'all',
    unlockedScopes: ['all', 'web', 'chrome', 'shopify', 'wordpress'],
    purchaseEnabled: true,
    current: false,
  },
] as const;

function planClass(plan: string): string {
  if (plan === 'paid') return 'pill pill-paid';
  if (plan === 'trial') return 'pill pill-trial';
  return 'pill pill-free';
}

function planTitle(t: (key: string, params?: Record<string, string | number>) => string, planCode: PlanCode, fallback: string): string {
  const label = t(`app.planTitles.${planCode}`);
  return label === `app.planTitles.${planCode}` ? fallback : label;
}

function usageLabel(
  locale: string,
  period: 'hour' | 'day' | 'month',
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const translated = t(`app.usage.${period}`);
  if (translated !== `app.usage.${period}`) return translated;

  const fallback: Record<string, Record<'hour' | 'day' | 'month', string>> = {
    'en-GB': { hour: 'Hour', day: 'Day', month: 'Month' },
    'en-US': { hour: 'Hour', day: 'Day', month: 'Month' },
    'es-ES': { hour: 'Hora', day: 'Día', month: 'Mes' },
    'fr-FR': { hour: 'Heure', day: 'Jour', month: 'Mois' },
    'de-DE': { hour: 'Stunde', day: 'Tag', month: 'Monat' },
    ar: { hour: 'الساعة', day: 'اليوم', month: 'الشهر' },
    'zh-Hans': { hour: '小时', day: '天', month: '月' },
  };

  return fallback[locale]?.[period] ?? fallback['en-GB'][period];
}

export function AppPage() {
  const { locale, t } = useI18n();
  const { session, error, refresh, startSignIn, signOut, apiBaseUrl } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  useSeo('app');

  const auth = session.status === 'signedIn' ? session.auth : undefined;
  const sub = session.status === 'signedIn' ? session.sub : undefined;
  const plan = sub?.plan ?? 'free';
  const entitlements = sub?.entitlements;
  const hasAccess = session.status === 'signedIn' && Boolean(entitlements?.all || entitlements?.web);
  const catalog = sub?.catalog?.length ? sub.catalog : DEFAULT_CATALOG;

  const displayCatalog = useMemo(
    () =>
      catalog.map((entry) => ({
        ...entry,
        displayTitle: planTitle(t, entry.planCode, entry.title),
      })),
    [catalog, t],
  );

  const currentPlanTitle = displayCatalog.find((entry) => entry.current)?.displayTitle ?? t('app.free');
  const unlockedProducts = useMemo(() => {
    const scopes = entitlements?.all
      ? (['web', 'chrome', 'shopify', 'wordpress'] as const)
      : (['web', 'chrome', 'shopify', 'wordpress'] as const).filter((scope) => Boolean(entitlements?.[scope]));

    return scopes.map((scope) => {
      if (scope === 'web') return planTitle(t, 'plan_web', 'Web');
      if (scope === 'chrome') return planTitle(t, 'plan_chrome', 'Chrome Extension');
      if (scope === 'shopify') return planTitle(t, 'plan_shopify', 'Shopify');
      return planTitle(t, 'plan_wordpress', 'WordPress');
    });
  }, [entitlements, t]);

  const [language, setLanguage] = useState('');
  const [context, setContext] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [message, setMessage] = useState('');
  const [busyAll, setBusyAll] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLanguage(localStorage.getItem('atgp_pref_lang') || '');
    setContext(localStorage.getItem('atgp_pref_ctx') || '');
  }, []);

  useEffect(() => {
    localStorage.setItem('atgp_pref_lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('atgp_pref_ctx', context);
  }, [context]);

  useEffect(() => {
    const userId = auth?.userId || '';
    setRecent(readRecentItems(userId));
  }, [auth?.userId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const billing = params.get('billing');
    if (!billing) return;

    let cancelled = false;
    (async () => {
      if (billing === 'success') {
        try {
          await refresh();
          if (!cancelled) setMessage(t('app.messages.billingUpdated'));
        } catch (err) {
          if (!cancelled) setMessage(err instanceof Error ? err.message : String(err));
        }
      } else if (!cancelled) {
        setMessage(t('app.messages.billingCancelled'));
      }

      if (!cancelled) {
        navigate(buildRoutePath(locale, 'app'), { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search, locale, navigate, refresh, t]);

  const ensureSignedIn = useCallback(async () => {
    if (session.status === 'signedIn') return true;
    await startSignIn();
    return false;
  }, [session.status, startSignIn]);

  const onFilesSelected = useCallback(async (files: FileList) => {
    if (!files.length) return;
    const next = await filesToQueueItems(files);
    setItems((current) => [...next, ...current]);
  }, []);

  const onAddImageUrl = useCallback(() => {
    const raw = urlInput.trim();
    if (!raw) return;
    try {
      const item = createUrlQueueItem(raw);
      setItems((current) => [item, ...current]);
      setUrlInput('');
      setMessage('');
    } catch {
      setMessage(t('app.messages.invalidImageUrl'));
    }
  }, [t, urlInput]);

  const generateOne = useCallback(
    async (id: string) => {
      if (!(await ensureSignedIn()) || !auth?.token) return;
      if (!hasAccess) {
        setMessage(t('app.messages.webPlanRequired'));
        return;
      }

      let snapshot: QueueItem | undefined;
      setItems((current) =>
        current.map((item) => {
          if (item.id === id) {
            snapshot = item;
            return { ...item, status: 'generating', error: undefined };
          }
          return item;
        }),
      );

      if (!snapshot) return;

      try {
        const altText = await generateAltText(apiBaseUrl, auth.token, snapshot, {
          language,
          context,
        });

        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'done',
                  error: undefined,
                  altText,
                }
              : item,
          ),
        );

        const userId = auth.userId || '';
        if (userId) {
          const updated = addRecentItem(userId, {
            previewSrc: snapshot.dataUrl || snapshot.imageUrl || '',
            altText,
          });
          setRecent(updated);
        }
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'error',
                  error: text,
                }
              : item,
          ),
        );
        setMessage(text);
      }
    },
    [apiBaseUrl, auth?.token, auth?.userId, context, ensureSignedIn, hasAccess, language, t],
  );

  const onGenerateAll = useCallback(async () => {
    if (!items.length || busyAll) return;
    setBusyAll(true);
    try {
      const ids = items
        .filter((item) => !(item.status === 'done' && item.altText))
        .map((item) => item.id);
      for (const id of ids) {
        await generateOne(id);
      }
    } finally {
      setBusyAll(false);
    }
  }, [busyAll, generateOne, items]);

  const onCopy = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      await navigator.clipboard.writeText(text);
      setMessage(t('common.copiedToClipboard'));
    },
    [t],
  );

  const onDownload = useCallback(
    async (item: QueueItem) => {
      if (!item.altText) return;
      await downloadWithMetadata(item, item.altText);
      setMessage(t('app.messages.downloadedMetadata'));
    },
    [t],
  );

  const onManageSubscription = useCallback(async () => {
    if (!(await ensureSignedIn()) || !auth?.token) return;

    if (!sub?.hasStripeCustomer) {
      setMessage(t('app.messages.chooseSubscription'));
      return;
    }

    if (sub.providerPortalUrl) {
      window.location.assign(sub.providerPortalUrl);
      return;
    }

    try {
      const portalUrl = await createPortalSession(apiBaseUrl, auth.token, {
        client: 'web',
        returnOrigin: window.location.origin,
      });
      window.location.assign(portalUrl);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }, [apiBaseUrl, auth?.token, ensureSignedIn, sub?.hasStripeCustomer, sub?.providerPortalUrl, t]);

  const onSelectPlan = useCallback(
    async (entry: BillingCatalogEntry & { displayTitle?: string }) => {
      const title = entry.displayTitle ?? entry.title;
      if (entry.current) {
        setMessage(t('app.messages.currentPlan', { title }));
        return;
      }
      if (!entry.purchaseEnabled) {
        setMessage(t('app.messages.comingSoonPlan', { title }));
        return;
      }
      if (!(await ensureSignedIn()) || !auth?.token) return;

      if (plan !== 'free' && sub?.hasStripeCustomer) {
        await onManageSubscription();
        return;
      }

      try {
        const checkoutUrl = await createCheckoutSession(apiBaseUrl, auth.token, {
          planCode: entry.planCode,
          client: 'web',
          returnOrigin: window.location.origin,
          skipTrial: sub?.trialEligible === false,
        });
        window.location.assign(checkoutUrl);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err));
      }
    },
    [apiBaseUrl, auth?.token, ensureSignedIn, onManageSubscription, plan, sub?.hasStripeCustomer, sub?.trialEligible, t],
  );

  const onClearRecent = useCallback(() => {
    const userId = auth?.userId || '';
    clearRecentItems(userId);
    setRecent([]);
  }, [auth?.userId]);

  const disabledReason = useMemo(() => {
    if (session.status === 'loading') return t('app.disabled.loading');
    if (session.status !== 'signedIn') return t('app.disabled.signedOut');
    if (!hasAccess) return t('app.disabled.missingEntitlement');
    return '';
  }, [hasAccess, session.status, t]);

  function displayPlanLabel(): string {
    if (plan === 'paid') return t('app.paid');
    if (plan === 'trial') {
      if (!sub?.trialEndsAt) return t('app.trial');
      const end = new Date(sub.trialEndsAt).getTime();
      if (Number.isNaN(end)) return t('app.trial');
      const diff = Math.max(0, end - Date.now());
      const days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      return t('app.trialDaysLeft', { days });
    }
    return t('app.free');
  }

  function statusLabel(item: QueueItem): string {
    if (item.status === 'generating') return t('common.generating');
    if (item.status === 'error') return item.error || t('app.status.failed');
    if (item.status === 'done' && item.altText) return t('app.status.ready');
    return t('app.status.queued');
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link to={buildRoutePath(locale, 'landing')} className="brand">
            <span className="brand-mark">{t('brand.shortName')}</span>
            <span className="brand-text">
              <span className="brand-title">{t('brand.name')}</span>
              <span className="brand-sub">{t('brand.sharedTagline')}</span>
            </span>
          </Link>
          <div className="nav-actions">
            <LanguageSwitcher />
            <Link to={buildRoutePath(locale, 'landing')} className="btn btn-ghost">
              {t('common.home')}
            </Link>
            {session.status === 'signedIn' ? (
              <button type="button" className="btn btn-outline" onClick={signOut}>
                {t('common.signOut')}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => void startSignIn()}>
                {t('common.signIn')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-shell">
        <div className="container stack" style={{ gap: 14 }}>
          <div className="app-grid">
            <section className="panel stack">
              <div className="row wrap" style={{ justifyContent: 'space-between' }}>
                <h2>{t('app.accountHub')}</h2>
                <span className={planClass(plan)}>{displayPlanLabel()}</span>
              </div>

              {session.status === 'signedIn' ? (
                <>
                  <div className="stack" style={{ gap: 6 }}>
                    <strong>{auth?.displayName || auth?.email}</strong>
                    <div className="muted">{auth?.email}</div>
                    <div className="muted">
                      {t('app.currentPlanPrefix')} {currentPlanTitle}
                    </div>
                  </div>

                  <div className="stack" style={{ gap: 8 }}>
                    <div className="muted" style={{ fontSize: '0.88rem' }}>
                      {t('app.unlockedProducts')}
                    </div>
                    <div className="scope-pills">
                      {unlockedProducts.length ? (
                        unlockedProducts.map((scope) => (
                          <span key={scope} className="scope-pill">
                            {scope}
                          </span>
                        ))
                      ) : (
                        <span className="muted">{t('app.noEntitlements')}</span>
                      )}
                    </div>
                  </div>

                  <div className="row wrap">
                    <button type="button" className="btn btn-outline" onClick={() => void refresh()}>
                      {t('common.refreshStatus')}
                    </button>
                    {sub?.hasStripeCustomer ? (
                      <button type="button" className="btn btn-primary" onClick={() => void onManageSubscription()}>
                        {t('common.manageSwitchPlan')}
                      </button>
                    ) : null}
                  </div>

                  {!hasAccess ? <div className="notice notice-warning">{t('app.webEntitlementWarning')}</div> : null}
                </>
              ) : (
                <>
                  <p className="muted" style={{ margin: 0 }}>
                    {t('app.signInSharedAccount')}
                  </p>
                  <div>
                    <button type="button" className="btn btn-primary" onClick={() => void startSignIn()}>
                      {t('common.signIn')}
                    </button>
                  </div>
                </>
              )}

              {error ? <div className="notice notice-error">{error}</div> : null}
              {message ? <div className="notice notice-info">{message}</div> : null}
            </section>

            <aside className="panel stack">
              <h3>{t('app.usageHistory')}</h3>
              {session.status === 'signedIn' && sub?.usage && sub?.limits ? (
                <div className="stack" style={{ gap: 8 }}>
                  <div>
                    <strong>{usageLabel(locale, 'hour', t)}:</strong> {sub.usage.hour} / {sub.limits.hour}
                  </div>
                  <div>
                    <strong>{usageLabel(locale, 'day', t)}:</strong> {sub.usage.day} / {sub.limits.day}
                  </div>
                  <div>
                    <strong>{usageLabel(locale, 'month', t)}:</strong> {sub.usage.month} / {sub.limits.month}
                  </div>
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  {t('app.usageAfterSignIn')}
                </p>
              )}

              <div className="row wrap" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>{t('app.recentResults')}</h3>
                <button type="button" className="btn btn-outline" onClick={onClearRecent} disabled={!recent.length}>
                  {t('common.clear')}
                </button>
              </div>

              <div className="history-list">
                {recent.length ? (
                  recent.map((item) => (
                    <div key={item.id} className="history-item">
                      <div className="muted" style={{ marginBottom: 4 }}>
                        {new Date(item.when).toLocaleString(locale)}
                      </div>
                      <div style={{ fontWeight: 600 }}>{item.altText}</div>
                    </div>
                  ))
                ) : (
                  <div className="muted">{t('app.noRecentResults')}</div>
                )}
              </div>
            </aside>
          </div>

          <section className="panel stack">
            <div className="row wrap" style={{ justifyContent: 'space-between' }}>
              <div className="stack" style={{ gap: 4 }}>
                <h2>{t('app.plansTitle')}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {t('app.plansSubtitle')}
                </p>
              </div>
            </div>

            <div className="catalog-grid">
              {displayCatalog.map((entry) => {
                const unlockedScopes = entry.unlockedScopes.includes('all')
                  ? (['web', 'chrome', 'shopify', 'wordpress'] as const)
                  : entry.unlockedScopes.filter((scope) => scope !== 'all');
                const unlocked = unlockedScopes.map((scope) => {
                  if (scope === 'web') return planTitle(t, 'plan_web', 'Web');
                  if (scope === 'chrome') return planTitle(t, 'plan_chrome', 'Chrome Extension');
                  if (scope === 'shopify') return planTitle(t, 'plan_shopify', 'Shopify');
                  return planTitle(t, 'plan_wordpress', 'WordPress');
                });

                const actionLabel = entry.current
                  ? t('common.current')
                  : !entry.purchaseEnabled
                    ? t('common.comingSoon')
                    : session.status !== 'signedIn'
                      ? t('common.signInToChoose')
                      : plan !== 'free' && sub?.hasStripeCustomer
                        ? t('common.manageSwitch')
                        : sub?.trialEligible === false
                          ? t('common.choosePlan')
                          : t('common.startTrial');

                return (
                  <article
                    key={entry.planCode}
                    className={`plan-card${entry.current ? ' plan-card-current' : ''}${!entry.purchaseEnabled ? ' plan-card-disabled' : ''}`}
                  >
                    <div className="row wrap" style={{ justifyContent: 'space-between' }}>
                      <h3>{entry.displayTitle}</h3>
                      {entry.current ? (
                        <span className="badge badge-live">{t('common.current')}</span>
                      ) : !entry.purchaseEnabled ? (
                        <span className="badge badge-waitlist">{t('common.comingSoon')}</span>
                      ) : (
                        <span className="badge">{entry.scope === 'all' ? t('common.bundle') : t('common.singleProduct')}</span>
                      )}
                    </div>

                    <p>{t(`app.planDescriptions.${entry.planCode}`)}</p>

                    <div className="stack" style={{ gap: 8 }}>
                      <div className="muted" style={{ fontSize: '0.86rem' }}>
                        {t('app.unlocks')}
                      </div>
                      <div className="scope-pills">
                        {unlocked.map((scope) => (
                          <span key={`${entry.planCode}-${scope}`} className="scope-pill">
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={entry.current ? 'btn btn-outline' : 'btn btn-primary'}
                      disabled={entry.current || !entry.purchaseEnabled}
                      onClick={() => void onSelectPlan(entry)}
                    >
                      {actionLabel}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel stack">
            <div className="row wrap" style={{ justifyContent: 'space-between' }}>
              <h2>{t('app.generateTitle')}</h2>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void onGenerateAll()}
                disabled={busyAll || !items.length || Boolean(disabledReason)}
              >
                {busyAll ? t('common.generating') : t('common.generateAll')}
              </button>
            </div>

            <div className="app-grid">
              <div className="stack">
                <label htmlFor="language">{t('common.language')}</label>
                <select id="language" className="select" value={language} onChange={(event) => setLanguage(event.target.value)}>
                  {OUTPUT_LANGUAGES.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="input"
                  style={{ display: 'none' }}
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const files = event.target.files;
                    if (files) {
                      void onFilesSelected(files);
                      event.target.value = '';
                    }
                  }}
                />

                <div className="row wrap">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={Boolean(disabledReason)}
                    onClick={() => {
                      if (disabledReason) {
                        if (session.status !== 'signedIn') void startSignIn();
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                  >
                    {t('common.chooseFiles')}
                  </button>
                </div>

                <label htmlFor="image-url">{t('app.imageUrlLabel')}</label>
                <div className="row">
                  <input
                    id="image-url"
                    className="input"
                    placeholder={t('app.imageUrlPlaceholder')}
                    value={urlInput}
                    onChange={(event) => setUrlInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onAddImageUrl();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={onAddImageUrl}
                    disabled={Boolean(disabledReason)}
                  >
                    {t('common.add')}
                  </button>
                </div>
              </div>

              <div className="stack">
                <label htmlFor="context">{t('common.optionalContext')}</label>
                <textarea
                  id="context"
                  className="textarea"
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder={t('app.contextPlaceholder')}
                />
                {disabledReason ? <div className="notice notice-warning">{disabledReason}</div> : null}
              </div>
            </div>

            <div className="items">
              {items.length ? (
                items.map((item) => {
                  const previewSrc = item.dataUrl || item.imageUrl || '';
                  const canDownload = Boolean(item.altText && item.source === 'upload' && item.dataUrl);
                  return (
                    <article key={item.id} className="item">
                      <img className="item-thumb" src={previewSrc} alt={item.altText || item.name} />
                      <div className="item-meta">
                        <div className="row wrap" style={{ justifyContent: 'space-between' }}>
                          <div className="item-title">
                            {item.name} · {item.source === 'upload' ? formatFileSize(item.size) : t('app.urlImage')}
                          </div>
                          <span className="pill pill-free">{statusLabel(item)}</span>
                        </div>

                        {item.error ? <div className="notice notice-error">{item.error}</div> : null}

                        <div className="item-alt">{item.altText || t('app.noAltTextYet')}</div>

                        <div className="row wrap">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={item.status === 'generating' || Boolean(disabledReason)}
                            onClick={() => void generateOne(item.id)}
                          >
                            {item.status === 'generating' ? t('common.generating') : t('common.generate')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={!item.altText}
                            onClick={() => void onCopy(item.altText)}
                          >
                            {t('common.copy')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={!canDownload}
                            onClick={() => void onDownload(item)}
                            title={canDownload ? t('app.metadataDownloadTitle') : t('app.metadataUploadOnly')}
                          >
                            {t('common.downloadMetadata')}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="notice notice-info">{t('app.noItems')}</div>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
