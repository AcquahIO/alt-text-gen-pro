import { useCallback, useEffect, useMemo, useRef, useState, type MouseEventHandler } from 'react';
import { RecentImage } from '@/components/RecentImage';
import { UploadSection } from '@/components/UploadSection';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import brandIcon from '@extension/icons/icon-128.png';
import { filesToPendingEntries } from '@/lib/uploads';
import {
  clearRecentItems,
  getPendingUploads,
  getPreferredLanguage,
  getRecentItems,
  getSavedContext,
  openFullPageView,
  setPreferredLanguage,
  setSavedContext,
  storePendingUploads,
  queueActiveTabImagesForFullPage,
} from '@/lib/extension';
import { PendingUploadEntry, RecentAltItem } from '@/lib/types';
import { getUsageAllowance, type PlanCode, useSession } from '@/lib/session';
import { PlanBadge } from './components/PlanBadge';
import { Avatar } from './components/Avatar';
import { ChevronDown, Loader2, UserRound } from 'lucide-react';

interface ApiResult<T> {
  data?: T;
  error?: string;
}

function accountLabel(displayName: string, email: string): string {
  const source = displayName && !displayName.includes('@') ? displayName : email.split('@')[0] || 'Account';
  const first = source.trim().split(/[\s._-]+/)[0] || 'Account';
  return first.charAt(0).toUpperCase() + first.slice(1);
}

const COMMAND_PREVIEW = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('preview') === 'command';

const COMMAND_PREVIEW_ENTRIES: PendingUploadEntry[] = [
  {
    name: 'oak-chair-front.jpg',
    type: 'image/jpeg',
    size: 1180000,
    sourceUrl: '../apps/web/public/assets/seo-alt-text-hero.jpg',
  },
  {
    name: 'oak-side-table.jpg',
    type: 'image/png',
    size: 1320000,
    sourceUrl: '../apps/web/public/assets/oak-side-table-studio.jpg',
  },
  {
    name: 'pear-bowl.jpg',
    type: 'image/png',
    size: 1270000,
    sourceUrl: '../apps/web/public/assets/pear-bowl-studio.jpg',
  },
];

async function callAuthorizedApi<T = any>(
  baseUrl: string,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  try {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      const message = (payload as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
      return { error: message };
    }
    if (res.status === 204) {
      return { data: null as T };
    }
    const json = (await res.json()) as T;
    return { data: json };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function useRecentItems(userId: string, enabled: boolean) {
  const [recentItems, setRecentItems] = useState<RecentAltItem[]>([]);

  useEffect(() => {
    if (!enabled || !userId) {
      setRecentItems([]);
      return;
    }
    let mounted = true;
    (async () => {
      const recents = await getRecentItems(userId).catch(() => []);
      if (!mounted) return;
      setRecentItems(recents);
    })();
    return () => {
      mounted = false;
    };
  }, [enabled, userId]);

  const preparedRecents = useMemo(
    () =>
      recentItems.map((item, index) => ({
        ...item,
        id: `${item.srcUrl || item.altText}-${index}`,
      })),
    [recentItems],
  );

  const clearRecents = useCallback(async () => {
    if (!userId) return;
    await clearRecentItems(userId);
    setRecentItems([]);
  }, [userId]);

  return { preparedRecents, clearRecents };
}

export default function PopupApp() {
  const { session, signIn, signOut, error, retry, baseUrl } = useSession();
  const token = session.status === 'signedIn' ? session.auth?.token ?? '' : '';
  const plan = session.status === 'signedIn' ? session.sub?.plan ?? 'free' : 'free';
  const entitlements = session.status === 'signedIn' ? session.sub?.entitlements : undefined;
  const entitlementAllowsChrome = Boolean(entitlements?.all || entitlements?.chrome);
  const hasAccess = session.status === 'signedIn' && entitlementAllowsChrome;

  const [language, setLanguage] = useState('');
  const [context, setContext] = useState('');
  const [queuedEntries, setQueuedEntries] = useState<PendingUploadEntry[]>([]);
  const [message, setMessage] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const prevSessionStatus = useRef(session.status);
  const activeUserId = session.status === 'signedIn' ? String(session.auth?.userId || '') : '';
  const { preparedRecents, clearRecents } = useRecentItems(activeUserId, session.status === 'signedIn');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [lang, ctx, pending] = await Promise.all([
        getPreferredLanguage().catch(() => ''),
        getSavedContext().catch(() => ''),
        getPendingUploads().catch(() => null),
      ]);
      if (!mounted) return;
      setLanguage(lang || '');
      setContext(COMMAND_PREVIEW && !ctx ? 'Solid oak dining chair · North & Pine' : (ctx || ''));
      setQueuedEntries(COMMAND_PREVIEW ? COMMAND_PREVIEW_ENTRIES : (pending?.entries || []));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };

    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (prevSessionStatus.current !== session.status) {
      // Clear stale status messages (e.g. "Signed out.") whenever auth state changes.
      setMessage('');
      prevSessionStatus.current = session.status;
    }
  }, [session.status]);

  const openFullPageAndClose = useCallback(async () => {
    await openFullPageView();
    try {
      window.close();
    } catch (err) {
      console.warn('Unable to close popup window', err);
    }
  }, []);

  const handleFilesSelected = useCallback(
    async (files: FileList) => {
      if (!files.length) return;
      try {
        const entries = await filesToPendingEntries(files);
        if (!entries.length) return;
        const next = [...queuedEntries, ...entries];
        await Promise.all([
          storePendingUploads(next, { language, context }),
          setPreferredLanguage(language || ''),
          setSavedContext(context || ''),
        ]);
        setQueuedEntries(next);
        setMessage(`${next.length} image${next.length === 1 ? '' : 's'} ready to generate.`);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Unable to prepare these images.');
      }
    },
    [language, context, queuedEntries],
  );

  const handleRemoveQueued = useCallback(async (index: number) => {
    const next = queuedEntries.filter((_, entryIndex) => entryIndex !== index);
    setQueuedEntries(next);
    await storePendingUploads(next, { language, context });
    setMessage(next.length ? `${next.length} image${next.length === 1 ? '' : 's'} ready to generate.` : 'Queue cleared.');
  }, [context, language, queuedEntries]);

  const handleOpenFullPage = useCallback(async () => {
    await Promise.all([
      storePendingUploads(queuedEntries, { language, context }),
      setPreferredLanguage(language || ''),
      setSavedContext(context || ''),
    ]);
    await openFullPageAndClose();
  }, [language, context, openFullPageAndClose, queuedEntries]);

  const handleGenerateCurrentPage = useCallback(async () => {
    await Promise.all([
      setPreferredLanguage(language || ''),
      setSavedContext(context || ''),
    ]);
    try {
      const result = await queueActiveTabImagesForFullPage({ language, context });
      if (!result.queued) {
        setMessage('No images found on this page.');
        return;
      }
      if (result.truncated) {
        setMessage(`Queued ${result.queued} of ${result.discovered} images (page scans are limited to 20).`);
      }
      await openFullPageAndClose();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to collect images from this page.');
    }
  }, [language, context, openFullPageAndClose]);

  const ensureSignedIn = useCallback(async () => {
    if (session.status === 'signedIn') return true;
    try {
      setMessage('');
      await signIn();
      setMessage('');
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Sign-in cancelled');
      return false;
    }
  }, [session.status, signIn]);

  const openCheckoutUrl = useCallback(async (url: string, successMessage: string) => {
    if (chrome?.tabs?.create) {
      await chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
    setMessage(successMessage);
  }, []);

  const startCheckout = useCallback(async (
    planCode: PlanCode,
    options: {
      skipTrial?: boolean;
      preparingMessage: string;
      successMessage: string;
    },
  ) => {
    if (session.status === 'signedIn' && !options.skipTrial && session.sub?.trialEligible === false) {
      setMessage('You have already used your free trial. Start a paid plan to keep generating alt text.');
      return;
    }
    if (!(await ensureSignedIn()) || !baseUrl || !token) return;
    setMessage(options.preparingMessage);
    const result = await callAuthorizedApi<{ url: string }>(baseUrl, token, '/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({
        planCode,
        ...(options.skipTrial ? { skipTrial: true } : {}),
      }),
    });
    if (result.error || !result.data) {
      setMessage(result.error ?? 'Unable to create checkout session');
      return;
    }
    await openCheckoutUrl(result.data.url, options.successMessage);
  }, [baseUrl, ensureSignedIn, openCheckoutUrl, session.status, session.sub?.trialEligible, token]);

  const startTrial = useCallback(async () => {
    await startCheckout('plan_chrome', {
      preparingMessage: 'Preparing Chrome trial checkout…',
      successMessage: 'Chrome trial checkout opened in a new tab.',
    });
  }, [startCheckout]);

  const startChromeSubscription = useCallback(async () => {
    await startCheckout('plan_chrome', {
      skipTrial: true,
      preparingMessage: 'Preparing Chrome subscription checkout…',
      successMessage: 'Chrome subscription checkout opened in a new tab.',
    });
  }, [startCheckout]);

  const openBillingPortal = useCallback(async () => {
    if (!(await ensureSignedIn()) || !baseUrl || !token) return;
    if (!session.sub?.hasStripeCustomer) {
      setMessage('Subscribe to Chrome to start your paid subscription.');
      return;
    }
    if (session.sub?.providerPortalUrl) {
      if (chrome?.tabs?.create) {
        await chrome.tabs.create({ url: session.sub.providerPortalUrl });
      } else {
        window.open(session.sub.providerPortalUrl, '_blank');
      }
      return;
    }
    setMessage('Opening billing portal…');
    const result = await callAuthorizedApi<{ url: string }>(baseUrl, token, '/api/create-portal-session', {
      method: 'POST',
    });
    if (result.error || !result.data) {
      setMessage(result.error ?? 'Unable to open billing portal');
      return;
    }
    if (chrome?.tabs?.create) {
      await chrome.tabs.create({ url: result.data.url });
    } else {
      window.open(result.data.url, '_blank');
    }
    setMessage('Billing portal opened.');
  }, [baseUrl, token, ensureSignedIn, session.sub?.providerPortalUrl, session.sub?.hasStripeCustomer]);

  const handleManageOrUpgrade = useCallback(async () => {
    if (plan === 'free') {
      setAccountOpen(true);
      if (session.sub?.trialEligible === false) {
        setMessage('Your free trial has already been used. Subscribe to Chrome to keep generating alt text.');
      } else {
        setMessage('Start your free trial or subscribe to Chrome from the account menu.');
      }
      return;
    }
    if (plan === 'trial' && !session.sub?.hasStripeCustomer) {
      setAccountOpen(true);
      setMessage('You’re on the free trial. Subscribe to Chrome when you are ready to continue.');
      return;
    }
    await openBillingPortal();
  }, [plan, openBillingPortal, session.sub?.hasStripeCustomer, session.sub?.trialEligible]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const handleSignIn = useCallback(async () => {
    await ensureSignedIn();
  }, [ensureSignedIn]);

  const handleDebugToggle = useCallback<MouseEventHandler<HTMLDivElement>>((event) => {
    if (event.altKey) {
      setShowDebug((prev) => !prev);
    }
  }, []);

  const authDisplayName = session.status === 'signedIn' ? session.auth?.displayName ?? session.auth?.email ?? '' : '';
  const authEmail = session.status === 'signedIn' ? session.auth?.email ?? '' : '';
  const accountTriggerLabel = accountLabel(authDisplayName, authEmail);
  const avatarUrl = session.status === 'signedIn' ? session.auth?.avatarUrl ?? null : null;
  const hasStripeCustomer = session.status === 'signedIn' ? Boolean(session.sub?.hasStripeCustomer) : false;
  const billingIssue = session.status === 'signedIn' ? session.sub?.billingIssue ?? null : null;
  const monthlyAllowance = session.status === 'signedIn'
    ? getUsageAllowance(session.sub, 'month')
    : null;
  const usage = session.status === 'signedIn' ? session.sub?.usage : undefined;
  const limits = session.status === 'signedIn' ? session.sub?.limits : undefined;
  const accountStatusLabel = billingIssue
    ? 'Billing needs attention'
    : plan === 'trial'
      ? 'Chrome trial active'
      : hasAccess
        ? 'Chrome subscription active'
        : 'Chrome access not active';

  const disabledMessage = useMemo(() => {
    if (session.status === 'loading') return 'Loading session…';
    if (session.status !== 'signedIn') return 'Sign in to start your free trial and generate alt text.';
    if (!hasAccess) return 'Your account does not include Chrome generation. Start a trial or Chrome subscription.';
    return undefined;
  }, [session.status, hasAccess]);

  return (
    <div className="command-popup">
      <header className="command-appbar">
        <div className="command-brand" onClick={handleDebugToggle}>
          <img src={brandIcon} alt="Alt Text Generator Pro" className="command-brand__icon" />
          <div className="command-brand__copy">
            <h1 className="command-brand__title">Alt Text Generator Pro</h1>
            {session.status === 'signedIn' ? <PlanBadge plan={plan} trialEndsAt={session.sub?.trialEndsAt} /> : null}
          </div>
        </div>

        {session.status === 'signedIn' ? (
          <div className="command-account-menu" ref={accountMenuRef}>
            <button
              type="button"
              className="command-account"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-controls="command-account-dropdown"
            >
              <UserRound size={17} strokeWidth={1.9} aria-hidden="true" />
              <span className="command-account__label">{accountTriggerLabel}</span>
              <ChevronDown
                size={15}
                aria-hidden="true"
                style={{ transform: accountOpen ? 'rotate(180deg)' : undefined, transition: 'transform 150ms ease' }}
              />
            </button>

            {accountOpen ? (
              <section id="command-account-dropdown" className="command-account-dropdown" aria-label="Account options">
                <div className="command-account-profile">
                  <Avatar url={avatarUrl ?? undefined} name={authDisplayName} tone={plan} />
                  <div className="command-account-profile__copy">
                    <strong>{authDisplayName || authEmail}</strong>
                    <span>{authEmail}</span>
                  </div>
                </div>

                <div className={`command-account-status${billingIssue ? ' command-account-status--issue' : ''}`}>
                  <strong>{accountStatusLabel}</strong>
                  {plan === 'trial' && session.sub?.trialEndsAt ? (
                    <span>Trial ends {new Date(session.sub.trialEndsAt).toLocaleDateString()}</span>
                  ) : plan === 'paid' && session.sub?.renewsAt && !billingIssue ? (
                    <span>Renews {new Date(session.sub.renewsAt).toLocaleDateString()}</span>
                  ) : null}
                </div>

                <div className="command-account-divider" />

                {billingIssue ? (
                  <div className="command-billing-issue" role="alert">
                    <strong>{billingIssue.title}</strong>
                    <span>{billingIssue.detail}</span>
                  </div>
                ) : null}

                {hasAccess ? (
                  monthlyAllowance ? (
                    <div className="command-allowance">
                      <div className="command-allowance__heading">
                        <div>
                          <span>Monthly allowance</span>
                          <strong>{monthlyAllowance.used.toLocaleString()} / {monthlyAllowance.limit.toLocaleString()}</strong>
                        </div>
                        <b>{monthlyAllowance.remaining.toLocaleString()} left</b>
                      </div>
                      <div
                        className="command-allowance__track"
                        role="progressbar"
                        aria-label="Monthly generation allowance used"
                        aria-valuemin={0}
                        aria-valuemax={monthlyAllowance.limit}
                        aria-valuenow={Math.min(monthlyAllowance.used, monthlyAllowance.limit)}
                      >
                        <span style={{ width: `${monthlyAllowance.percentUsed}%` }} />
                      </div>
                      {usage && limits ? (
                        <p>{usage.day.toLocaleString()} / {limits.day.toLocaleString()} today · {usage.hour.toLocaleString()} / {limits.hour.toLocaleString()} this hour</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="command-account-muted">Usage allowance is unavailable. Retry the account status.</p>
                  )
                ) : null}

                <div className="command-account-divider" />

                {billingIssue && hasStripeCustomer ? (
                  <Button className="command-primary command-primary--wide" onClick={openBillingPortal}>Resolve billing</Button>
                ) : plan === 'free' && session.sub?.trialEligible !== false ? (
                  <>
                    <Button className="command-primary command-primary--wide" onClick={startTrial}>Start free trial</Button>
                    <button type="button" className="command-account-link" onClick={startChromeSubscription}>Subscribe to Chrome instead</button>
                  </>
                ) : plan === 'free' || (plan === 'trial' && !hasStripeCustomer) || (plan === 'paid' && !hasStripeCustomer) ? (
                  <>
                    <Button className="command-primary command-primary--wide" onClick={startChromeSubscription}>Subscribe to Chrome</Button>
                    {plan === 'free' && session.sub?.trialEligible === false ? (
                      <p className="command-account-muted">The free trial has already been used on this account.</p>
                    ) : null}
                  </>
                ) : (
                  <Button className="command-primary command-primary--wide" onClick={openBillingPortal}>Manage subscription</Button>
                )}

                <div className="command-account-divider" />
                <Button className="command-danger-button command-signout" variant="ghost" onClick={handleSignOut}>Sign out</Button>
              </section>
            ) : null}
          </div>
        ) : session.status === 'loading' ? (
          <Loader2 size={18} className="animate-spin" color="#667085" aria-label="Loading account" />
        ) : (
          <PlanBadge plan="free" />
        )}
      </header>

      {session.status !== 'signedIn' ? (
        <div className="command-auth-strip">
          <div className="command-auth-strip__copy">
            <p className="command-auth-strip__title">Sign in to generate</p>
            <p className="command-auth-strip__body">Your account, billing and allowance stay with the extension.</p>
          </div>
          <Button className="command-primary" onClick={handleSignIn} disabled={session.status === 'loading'}>
            {session.status === 'loading' ? 'Opening…' : 'Sign in'}
          </Button>
        </div>
      ) : null}

      <main className="command-main">
        {error ? (
          <div className="command-notice command-notice--error" style={{ marginTop: 14 }}>
            <span>{error}</span>
            <Button className="command-secondary" size="sm" onClick={retry}>Retry</Button>
          </div>
        ) : null}

        {message ? <div className="command-notice command-notice--info" style={{ marginTop: 14 }}>{message}</div> : null}

        {session.status === 'signedIn' && preparedRecents.length > 0 ? (
          <RecentImage items={preparedRecents} onClear={clearRecents} />
        ) : null}

        <UploadSection
          language={language}
          onLanguageChange={async (value) => {
            setLanguage(value);
            await setPreferredLanguage(value);
          }}
          context={context}
          onContextChange={async (value) => {
            setContext(value);
            await setSavedContext(value);
          }}
          queuedItems={queuedEntries}
          onFilesSelected={handleFilesSelected}
          onRemoveQueued={handleRemoveQueued}
          onOpenFullPage={handleOpenFullPage}
          onGenerateUploads={handleOpenFullPage}
          onGenerateCurrentPage={handleGenerateCurrentPage}
          disabled={!hasAccess || session.status === 'loading'}
          disabledMessage={disabledMessage}
          onRequireAuth={async () => {
            if (session.status === 'signedIn' && !hasAccess) {
              await handleManageOrUpgrade();
            } else {
              await ensureSignedIn();
            }
          }}
        />

        {showDebug ? (
          <div className="command-notice command-notice--info" style={{ marginBottom: 12 }}>
            Base: {baseUrl ?? 'resolving…'} · Plan: {JSON.stringify(session.status === 'signedIn' ? session.sub ?? null : null)}
          </div>
        ) : null}
      </main>
      <Toaster richColors position="top-center" />
    </div>
  );
}
