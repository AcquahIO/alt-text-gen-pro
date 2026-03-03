import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { changePlan, createCheckoutSession, createPortalSession, generateAltText, previewPlanChange } from '@/lib/api';
import { addRecentItem, clearRecentItems, readRecentItems } from '@/lib/history';
import { downloadWithMetadata } from '@/lib/metadata';
import { useSeo } from '@/lib/seo';
import { useSession } from '@/lib/session';
import { BillingCatalogEntry, BillingPrice, ClientScope, PlanChangePreview, PlanCode, QueueItem, RecentItem } from '@/lib/types';
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

const SELF_SERVE_PLAN_CODES: readonly PlanCode[] = ['plan_web', 'plan_chrome', 'plan_all_access'] as const;
const ALL_CLIENT_SCOPES: readonly ClientScope[] = ['web', 'chrome', 'shopify', 'wordpress'] as const;

interface DisplayBillingCatalogEntry extends BillingCatalogEntry {
  displayTitle: string;
  unlockedLabels: string[];
  gainsLabels: string[];
  losesLabels: string[];
}

const DEFAULT_CATALOG: BillingCatalogEntry[] = [
  {
    planCode: 'plan_web',
    title: 'Web',
    scope: 'web',
    unlockedScopes: ['web'],
    purchaseEnabled: true,
    current: false,
    price: null,
    recommended: false,
    preservesCurrentAccess: true,
    gainsScopes: ['web'],
    losesScopes: [],
    actionKind: 'checkout',
    changeMode: 'upgrade',
  },
  {
    planCode: 'plan_chrome',
    title: 'Chrome Extension',
    scope: 'chrome',
    unlockedScopes: ['chrome'],
    purchaseEnabled: true,
    current: false,
    price: null,
    recommended: false,
    preservesCurrentAccess: true,
    gainsScopes: ['chrome'],
    losesScopes: [],
    actionKind: 'checkout',
    changeMode: 'upgrade',
  },
  {
    planCode: 'plan_shopify',
    title: 'Shopify',
    scope: 'shopify',
    unlockedScopes: ['shopify'],
    purchaseEnabled: false,
    current: false,
    price: null,
    recommended: false,
    preservesCurrentAccess: true,
    gainsScopes: ['shopify'],
    losesScopes: [],
    actionKind: 'unavailable',
    changeMode: 'upgrade',
  },
  {
    planCode: 'plan_wordpress',
    title: 'WordPress',
    scope: 'wordpress',
    unlockedScopes: ['wordpress'],
    purchaseEnabled: false,
    current: false,
    price: null,
    recommended: false,
    preservesCurrentAccess: true,
    gainsScopes: ['wordpress'],
    losesScopes: [],
    actionKind: 'unavailable',
    changeMode: 'upgrade',
  },
  {
    planCode: 'plan_all_access',
    title: 'All Access',
    scope: 'all',
    unlockedScopes: ['all', 'web', 'chrome', 'shopify', 'wordpress'],
    purchaseEnabled: true,
    current: false,
    price: null,
    recommended: false,
    preservesCurrentAccess: true,
    gainsScopes: ['web', 'chrome', 'shopify', 'wordpress'],
    losesScopes: [],
    actionKind: 'checkout',
    changeMode: 'upgrade',
  },
] as const;

function planTitle(t: (key: string, params?: Record<string, string | number>) => string, planCode: PlanCode, fallback: string): string {
  const label = t(`app.planTitles.${planCode}`);
  return label === `app.planTitles.${planCode}` ? fallback : label;
}

function scopeToPlanCode(scope: ClientScope): PlanCode {
  switch (scope) {
    case 'web':
      return 'plan_web';
    case 'chrome':
      return 'plan_chrome';
    case 'shopify':
      return 'plan_shopify';
    case 'wordpress':
      return 'plan_wordpress';
    default:
      return 'plan_web';
  }
}

function scopeLabel(
  t: (key: string, params?: Record<string, string | number>) => string,
  scope: ClientScope,
): string {
  return planTitle(t, scopeToPlanCode(scope), scope);
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

function formatCurrency(locale: string, unitAmount: number, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(unitAmount / 100);
}

function formatRecurringPrice(
  locale: string,
  price: BillingPrice | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!price) return t('app.billing.unavailablePrice');
  const amount = formatCurrency(locale, price.unitAmount, price.currency);
  const intervalKey = price.interval === 'year' ? 'yearShort' : 'monthShort';
  const interval = t(`app.billing.${intervalKey}`);
  if (price.intervalCount === 1) {
    return `${amount}/${interval}`;
  }
  return t('app.billing.everyInterval', {
    amount,
    count: price.intervalCount,
    interval,
  });
}

function formatCharge(
  locale: string,
  charge: { unitAmount: number; currency: string } | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!charge) return t('app.billing.noChargeToday');
  return formatCurrency(locale, charge.unitAmount, charge.currency);
}

function formatDate(locale: string, value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatList(locale: string, values: string[]): string {
  if (!values.length) return '';
  if (values.length === 1) return values[0];
  return values.join(', ');
}

function formatScopedNames(
  locale: string,
  t: (key: string, params?: Record<string, string | number>) => string,
  scopes: ClientScope[],
): string {
  return formatList(
    locale,
    scopes.map((scope) => scopeLabel(t, scope)),
  );
}

export function AppPage() {
  const { locale, t } = useI18n();
  const { session, error, refresh, startSignIn, signOut, apiBaseUrl } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const plansRef = useRef<HTMLElement | null>(null);

  useSeo('app');

  const auth = session.status === 'signedIn' ? session.auth : undefined;
  const sub = session.status === 'signedIn' ? session.sub : undefined;
  const plan = sub?.plan ?? 'free';
  const entitlements = sub?.entitlements;
  const hasAccess = session.status === 'signedIn' && Boolean(entitlements?.all || entitlements?.web);
  const catalog = sub?.catalog?.length ? sub.catalog : DEFAULT_CATALOG;

  const displayCatalog = useMemo<DisplayBillingCatalogEntry[]>(
    () =>
      catalog.map((entry) => {
        const unlockedScopes = entry.unlockedScopes.includes('all')
          ? [...ALL_CLIENT_SCOPES]
          : entry.unlockedScopes.filter((scope): scope is ClientScope => scope !== 'all');

        return {
          ...entry,
          displayTitle: planTitle(t, entry.planCode, entry.title),
          unlockedLabels: unlockedScopes.map((scope) => scopeLabel(t, scope)),
          gainsLabels: entry.gainsScopes.map((scope) => scopeLabel(t, scope)),
          losesLabels: entry.losesScopes.map((scope) => scopeLabel(t, scope)),
        };
      }),
    [catalog, t],
  );

  const currentPlanEntry = displayCatalog.find((entry) => entry.current);
  const currentPlanTitle = currentPlanEntry?.displayTitle ?? t('app.free');
  const selfServeCatalog = displayCatalog.filter((entry) => SELF_SERVE_PLAN_CODES.includes(entry.planCode));
  const roadmapCatalog = displayCatalog.filter((entry) => !SELF_SERVE_PLAN_CODES.includes(entry.planCode));
  const recommendedPlan = displayCatalog.find((entry) => entry.recommended) ?? null;
  const currentPlanLabels = currentPlanEntry?.unlockedLabels ?? [];
  const unlockedProducts = useMemo(() => {
    const scopes = entitlements?.all
      ? (['web', 'chrome', 'shopify', 'wordpress'] as const)
      : (['web', 'chrome', 'shopify', 'wordpress'] as const).filter((scope) => Boolean(entitlements?.[scope]));

    return scopes.map((scope) => scopeLabel(t, scope));
  }, [entitlements, t]);

  const [language, setLanguage] = useState('');
  const [context, setContext] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [message, setMessage] = useState('');
  const [busyAll, setBusyAll] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<DisplayBillingCatalogEntry | null>(null);
  const [planPreview, setPlanPreview] = useState<PlanChangePreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [planActionBusy, setPlanActionBusy] = useState(false);
  const [planDialogError, setPlanDialogError] = useState('');
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

  useEffect(() => {
    if (session.status !== 'signedIn') {
      setSelectedPlan(null);
      setPlanPreview(null);
      setPlanDialogError('');
      setPreviewBusy(false);
      setPlanActionBusy(false);
    }
  }, [session.status]);

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

  const closePlanDialog = useCallback(() => {
    if (planActionBusy) return;
    setSelectedPlan(null);
    setPlanPreview(null);
    setPlanDialogError('');
    setPreviewBusy(false);
  }, [planActionBusy]);

  const onManageBilling = useCallback(async () => {
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

  const openPlanDialog = useCallback(
    async (entry: DisplayBillingCatalogEntry) => {
      if (entry.current) {
        setMessage(t('app.messages.currentPlan', { title: entry.displayTitle }));
        return;
      }
      if (entry.actionKind === 'unavailable' || !entry.purchaseEnabled) {
        setMessage(t('app.messages.comingSoonPlan', { title: entry.displayTitle }));
        return;
      }
      if (!(await ensureSignedIn()) || !auth?.token) return;

      setSelectedPlan(entry);
      setPlanPreview(null);
      setPlanDialogError('');
      setPreviewBusy(true);

      try {
        const preview = await previewPlanChange(apiBaseUrl, auth.token, {
          planCode: entry.planCode,
        });
        setPlanPreview(preview);
      } catch (err) {
        setPlanDialogError(err instanceof Error ? err.message : String(err));
      } finally {
        setPreviewBusy(false);
      }
    },
    [apiBaseUrl, auth?.token, ensureSignedIn, t],
  );

  const onConfirmPlanAction = useCallback(async () => {
    if (!(await ensureSignedIn()) || !auth?.token || !selectedPlan) return;
    setPlanActionBusy(true);
    setPlanDialogError('');

    try {
      if (planPreview?.requiresBillingResolution) {
        await onManageBilling();
        return;
      }

      if (selectedPlan.actionKind === 'checkout') {
        const checkoutUrl = await createCheckoutSession(apiBaseUrl, auth.token, {
          planCode: selectedPlan.planCode,
          client: 'web',
          returnOrigin: window.location.origin,
          skipTrial: sub?.trialEligible === false,
        });
        window.location.assign(checkoutUrl);
        return;
      }

      await changePlan(apiBaseUrl, auth.token, {
        planCode: selectedPlan.planCode,
      });
      await refresh();
      setMessage(
        selectedPlan.losesLabels.length
          ? t('app.messages.planSwitched', { title: selectedPlan.displayTitle })
          : t('app.messages.planChanged', { title: selectedPlan.displayTitle }),
      );
      setSelectedPlan(null);
      setPlanPreview(null);
    } catch (err) {
      setPlanDialogError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlanActionBusy(false);
    }
  }, [
    apiBaseUrl,
    auth?.token,
    ensureSignedIn,
    onManageBilling,
    planPreview?.requiresBillingResolution,
    refresh,
    selectedPlan,
    sub?.trialEligible,
    t,
  ]);

  const onClearRecent = useCallback(() => {
    const userId = auth?.userId || '';
    clearRecentItems(userId);
    setRecent([]);
  }, [auth?.userId]);

  const scrollToPlans = useCallback(() => {
    plansRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const disabledReason = useMemo(() => {
    if (session.status === 'loading') return t('app.disabled.loading');
    if (session.status !== 'signedIn') return t('app.disabled.signedOut');
    if (!hasAccess) return t('app.disabled.missingEntitlement');
    return '';
  }, [hasAccess, session.status, t]);

  const currentSubscriptionLabel = useMemo(() => {
    if (plan === 'free') return t('app.summary.currentSubscriptionFree');
    if (sub?.billingIssue) {
      return t('app.summary.currentSubscriptionIssue', { title: currentPlanTitle });
    }
    if (plan === 'trial') {
      return t('app.summary.currentSubscriptionTrial', { title: currentPlanTitle });
    }
    return t('app.summary.currentSubscriptionPaid', { title: currentPlanTitle });
  }, [currentPlanTitle, plan, sub?.billingIssue, t]);

  const primarySummaryAction = useMemo(() => {
    if (session.status !== 'signedIn') return null;
    if (sub?.billingIssue && sub?.hasStripeCustomer) {
      return {
        label: t('common.manageBilling'),
        onClick: () => void onManageBilling(),
      };
    }
    if (!recommendedPlan) return null;
    const actionLabel = recommendedPlan.losesLabels.length
      ? t('app.actions.switchToOnly', { title: recommendedPlan.displayTitle })
      : plan === 'free'
        ? sub?.trialEligible === false
          ? t('app.actions.choosePlan', { title: recommendedPlan.displayTitle })
          : t('app.actions.startTrialFor', { title: recommendedPlan.displayTitle })
        : t('app.actions.upgradeTo', { title: recommendedPlan.displayTitle });
    return {
      label: `${actionLabel} — ${formatRecurringPrice(locale, recommendedPlan.price, t)}`,
      onClick: () => void openPlanDialog(recommendedPlan),
    };
  }, [locale, onManageBilling, openPlanDialog, plan, recommendedPlan, session.status, sub?.billingIssue, sub?.hasStripeCustomer, sub?.trialEligible, t]);

  const recommendedKeeps = useMemo(
    () => currentPlanLabels.filter((label) => !recommendedPlan?.losesLabels.includes(label)),
    [currentPlanLabels, recommendedPlan?.losesLabels],
  );

  const recommendedAdds = recommendedPlan?.gainsLabels ?? [];

  const modalCurrentEntry = useMemo(
    () => (planPreview?.currentPlanCode ? displayCatalog.find((entry) => entry.planCode === planPreview.currentPlanCode) ?? null : null),
    [displayCatalog, planPreview?.currentPlanCode],
  );
  const modalKeepLabels = useMemo(
    () =>
      modalCurrentEntry
        ? modalCurrentEntry.unlockedLabels.filter((label) => !selectedPlan?.losesLabels.includes(label))
        : [],
    [modalCurrentEntry, selectedPlan?.losesLabels],
  );

  const planActionLabel = useCallback(
    (entry: DisplayBillingCatalogEntry): string => {
      if (entry.current) return t('app.actions.currentPlan');
      if (entry.actionKind === 'unavailable') return t('common.comingSoon');
      if (session.status !== 'signedIn') return t('common.signInToChoose');
      if (sub?.billingIssue && entry.actionKind === 'change_plan') return t('common.resolveBilling');
      if (entry.actionKind === 'checkout') {
        return sub?.trialEligible === false
          ? t('app.actions.choosePlan', { title: entry.displayTitle })
          : t('app.actions.startTrialFor', { title: entry.displayTitle });
      }
      if (entry.losesLabels.length) {
        return t('app.actions.switchToOnly', { title: entry.displayTitle });
      }
      if (entry.changeMode === 'upgrade') {
        return t('app.actions.upgradeTo', { title: entry.displayTitle });
      }
      return t('app.actions.changeTo', { title: entry.displayTitle });
    },
    [session.status, sub?.billingIssue, sub?.trialEligible, t],
  );

  const billingEffectLabel = useCallback(
    (entry: DisplayBillingCatalogEntry): string => {
      if (entry.current) return t('app.compare.effectCurrent');
      if (!entry.losesLabels.length && entry.gainsLabels.length) {
        return t('app.compare.effectKeepAdd', { gains: formatList(locale, entry.gainsLabels) });
      }
      if (entry.losesLabels.length) {
        return t('app.compare.effectReplace', { loses: formatList(locale, entry.losesLabels) });
      }
      return t('app.compare.effectKeep');
    },
    [locale, t],
  );

  const modalTitle = selectedPlan
    ? planPreview?.requiresBillingResolution
      ? t('app.modal.resolveBillingTitle')
      : selectedPlan.actionKind === 'checkout'
        ? t('app.modal.checkoutTitle', { title: selectedPlan.displayTitle })
        : selectedPlan.losesLabels.length
          ? t('app.modal.switchTitle', { title: selectedPlan.displayTitle })
          : t('app.modal.upgradeTitle', { title: selectedPlan.displayTitle })
    : '';

  const modalConfirmLabel = planPreview?.requiresBillingResolution
    ? t('common.manageBilling')
    : selectedPlan?.actionKind === 'checkout'
      ? t('app.modal.continueToCheckout')
      : selectedPlan?.losesLabels.length
        ? t('common.switchPlan')
        : t('common.upgrade');

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
            <section className="panel stack billing-summary-panel">
              <div className="stack" style={{ gap: 6 }}>
                <h2>{t('app.accountHub')}</h2>
                {session.status === 'signedIn' ? (
                  <>
                    <strong>{auth?.displayName || auth?.email}</strong>
                    <div className="muted">{auth?.email}</div>
                    <div className="billing-summary-line">{currentSubscriptionLabel}</div>
                    {plan === 'trial' && sub?.trialEndsAt ? (
                      <div className="muted">{t('app.summary.trialEnds', { date: formatDate(locale, sub.trialEndsAt) })}</div>
                    ) : null}
                    {plan === 'paid' && sub?.renewsAt && !sub?.billingIssue ? (
                      <div className="muted">{t('app.summary.nextRenewal', { date: formatDate(locale, sub.renewsAt) })}</div>
                    ) : null}
                    <div className="muted">{t('app.summary.includedToday', { items: unlockedProducts.length ? formatList(locale, unlockedProducts) : t('app.noEntitlements') })}</div>
                    {!hasAccess ? <div className="muted">{t('app.summary.missingForApp', { items: t('app.summary.webGeneration') })}</div> : null}
                    {recommendedPlan && !sub?.billingIssue ? (
                      <div className="billing-summary-block">
                        <div className="summary-label">{t('app.summary.recommendedNextStep', { title: recommendedPlan.displayTitle })}</div>
                        {recommendedKeeps.length ? (
                          <div className="muted">{t('app.summary.keeps', { items: formatList(locale, recommendedKeeps) })}</div>
                        ) : null}
                        {recommendedAdds.length ? (
                          <div className="muted">{t('app.summary.adds', { items: formatList(locale, recommendedAdds) })}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    {t('app.signInSharedAccount')}
                  </p>
                )}
              </div>

              {session.status === 'signedIn' ? (
                <>
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

                  <div className="row wrap">
                    {primarySummaryAction ? (
                      <button type="button" className="btn btn-primary" onClick={primarySummaryAction.onClick}>
                        {primarySummaryAction.label}
                      </button>
                    ) : null}
                    {sub?.hasStripeCustomer ? (
                      <button type="button" className="btn btn-outline" onClick={() => void onManageBilling()}>
                        {sub?.billingIssue ? t('common.resolveBilling') : t('common.manageBilling')}
                      </button>
                    ) : null}
                    <button type="button" className="btn btn-ghost" onClick={scrollToPlans}>
                      {t('common.changePlan')}
                    </button>
                  </div>

                  {sub?.billingIssue ? (
                    <div className="notice notice-error">
                      <strong>{sub.billingIssue.title}</strong>
                      <div>{sub.billingIssue.detail}</div>
                    </div>
                  ) : null}
                  {!hasAccess ? <div className="notice notice-warning">{t('app.webEntitlementWarning')}</div> : null}
                </>
              ) : (
                <div>
                  <button type="button" className="btn btn-primary" onClick={() => void startSignIn()}>
                    {t('common.signIn')}
                  </button>
                </div>
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

          <section ref={plansRef} className="panel stack">
            <div className="stack" style={{ gap: 4 }}>
              <h2>{t('app.plansTitle')}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {t('app.plansSubtitle')}
              </p>
            </div>

            <div className="compare-scroll">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>{t('app.compare.header')}</th>
                    {selfServeCatalog.map((entry) => (
                      <th key={entry.planCode} className={entry.current ? 'compare-head compare-head-current' : 'compare-head'}>
                        <div className="compare-plan-head">
                          <div className="row wrap" style={{ justifyContent: 'space-between' }}>
                            <strong>{entry.displayTitle}</strong>
                            <div className="row wrap">
                              {entry.recommended ? <span className="badge badge-live">{t('common.recommended')}</span> : null}
                              {entry.current ? (
                                <span className="badge badge-live">{t('common.current')}</span>
                              ) : (
                                <span className="badge">{entry.scope === 'all' ? t('common.bundle') : t('common.singleProduct')}</span>
                              )}
                            </div>
                          </div>
                          <div className="compare-price">{formatRecurringPrice(locale, entry.price, t)}</div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>{t('app.compare.bestFor')}</th>
                    {selfServeCatalog.map((entry) => (
                      <td key={`${entry.planCode}-best`}>{t(`app.planBestFor.${entry.planCode}`)}</td>
                    ))}
                  </tr>
                  <tr>
                    <th>{t('app.compare.includes')}</th>
                    {selfServeCatalog.map((entry) => (
                      <td key={`${entry.planCode}-includes`}>
                        <div className="scope-pills">
                          {entry.unlockedLabels.map((label) => (
                            <span key={`${entry.planCode}-${label}`} className="scope-pill">
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th>{t('app.compare.effect')}</th>
                    {selfServeCatalog.map((entry) => (
                      <td key={`${entry.planCode}-effect`}>
                        <div className={`compare-effect${entry.losesLabels.length ? ' compare-effect-warning' : ''}`}>
                          {billingEffectLabel(entry)}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th>{t('app.compare.action')}</th>
                    {selfServeCatalog.map((entry) => {
                      const disableForBillingIssue = Boolean(sub?.billingIssue && entry.actionKind === 'change_plan' && !entry.current);
                      return (
                        <td key={`${entry.planCode}-action`}>
                          <button
                            type="button"
                            className={entry.recommended ? 'btn btn-primary' : 'btn btn-outline'}
                            disabled={entry.current || entry.actionKind === 'unavailable' || disableForBillingIssue}
                            onClick={() => void openPlanDialog(entry)}
                          >
                            {planActionLabel(entry)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="roadmap-section stack">
              <div className="stack" style={{ gap: 4 }}>
                <h3>{t('app.roadmapTitle')}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {t('app.roadmapSubtitle')}
                </p>
              </div>

              <div className="catalog-grid roadmap-grid">
                {roadmapCatalog.map((entry) => (
                  <article key={entry.planCode} className="plan-card plan-card-disabled roadmap-card">
                    <div className="row wrap" style={{ justifyContent: 'space-between' }}>
                      <h3>{entry.displayTitle}</h3>
                      <span className="badge badge-waitlist">{t('common.comingSoon')}</span>
                    </div>
                    <p>{t(`app.planDescriptions.${entry.planCode}`)}</p>
                    <div className="scope-pills">
                      {entry.unlockedLabels.map((label) => (
                        <span key={`${entry.planCode}-${label}`} className="scope-pill">
                          {label}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
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

      {selectedPlan ? (
        <div className="modal-backdrop" onClick={closePlanDialog}>
          <div
            className={`modal-card${selectedPlan.losesLabels.length ? ' modal-card-warning' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stack" style={{ gap: 4 }}>
                <h3 id="plan-modal-title">{modalTitle}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {selectedPlan.losesLabels.length
                    ? t('app.modal.switchSubtitle')
                    : t('app.modal.upgradeSubtitle')}
                </p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={closePlanDialog} disabled={planActionBusy}>
                {t('common.close')}
              </button>
            </div>

            {previewBusy ? <div className="notice notice-info">{t('app.modal.loading')}</div> : null}
            {!previewBusy && planDialogError ? <div className="notice notice-error">{planDialogError}</div> : null}

            {!previewBusy && !planDialogError && planPreview ? (
              <>
                <div className="modal-plan-grid">
                  <div className="modal-plan-card">
                    <div className="muted">{t('app.modal.currentPlan')}</div>
                    <strong>{modalCurrentEntry?.displayTitle ?? t('app.free')}</strong>
                  </div>
                  <div className="modal-plan-card">
                    <div className="muted">{t('app.modal.targetPlan')}</div>
                    <strong>{selectedPlan.displayTitle}</strong>
                  </div>
                </div>

                <div className="modal-scope-grid">
                  <div className="modal-scope-card">
                    <div className="summary-label">{t('common.keep')}</div>
                    <div className="scope-pills">
                      {modalKeepLabels.length ? (
                        modalKeepLabels.map((label) => (
                          <span key={`keep-${label}`} className="scope-pill">
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="muted">{t('app.modal.none')}</span>
                      )}
                    </div>
                  </div>
                  <div className="modal-scope-card">
                    <div className="summary-label">{t('common.gain')}</div>
                    <div className="scope-pills">
                      {selectedPlan.gainsLabels.length ? (
                        selectedPlan.gainsLabels.map((label) => (
                          <span key={`gain-${label}`} className="scope-pill">
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="muted">{t('app.modal.none')}</span>
                      )}
                    </div>
                  </div>
                  <div className="modal-scope-card">
                    <div className="summary-label">{t('common.lose')}</div>
                    <div className="scope-pills">
                      {selectedPlan.losesLabels.length ? (
                        selectedPlan.losesLabels.map((label) => (
                          <span key={`lose-${label}`} className="scope-pill scope-pill-danger">
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="muted">{t('app.modal.none')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal-pricing-grid">
                  <div className="modal-plan-card">
                    <div className="muted">{t('app.modal.priceToday')}</div>
                    <strong>{formatCharge(locale, planPreview.immediateCharge, t)}</strong>
                  </div>
                  <div className="modal-plan-card">
                    <div className="muted">{t('app.modal.nextRenewal')}</div>
                    <strong>
                      {planPreview.nextRenewal
                        ? formatRecurringPrice(
                            locale,
                            {
                              unitAmount: planPreview.nextRenewal.unitAmount,
                              currency: planPreview.nextRenewal.currency,
                              interval: selectedPlan.price?.interval ?? 'month',
                              intervalCount: selectedPlan.price?.intervalCount ?? 1,
                            },
                            t,
                          )
                        : t('app.billing.unavailablePrice')}
                    </strong>
                    {planPreview.nextRenewal?.date ? (
                      <div className="muted">{formatDate(locale, planPreview.nextRenewal.date)}</div>
                    ) : null}
                  </div>
                </div>

                {planPreview.preservesTrialUntil ? (
                  <div className="notice notice-info">
                    {t('app.modal.trialContinues', { date: formatDate(locale, planPreview.preservesTrialUntil) })}
                  </div>
                ) : null}

                {selectedPlan.losesLabels.length ? (
                  <div className="notice notice-warning">
                    {t('app.modal.replacementWarning', { items: formatList(locale, selectedPlan.losesLabels) })}
                  </div>
                ) : null}

                {planPreview.requiresBillingResolution ? (
                  <div className="notice notice-error">{t('app.modal.billingResolutionRequired')}</div>
                ) : null}

                <div className="row wrap modal-actions">
                  <button type="button" className="btn btn-outline" onClick={closePlanDialog} disabled={planActionBusy}>
                    {t('common.cancel')}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => void onConfirmPlanAction()} disabled={planActionBusy}>
                    {planActionBusy ? t('common.generating') : modalConfirmLabel}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
