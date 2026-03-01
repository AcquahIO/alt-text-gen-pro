import { useCallback, useEffect, useMemo, useRef, useState, type MouseEventHandler } from 'react';
import { RecentImage } from '@/components/RecentImage';
import { UploadSection } from '@/components/UploadSection';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { filesToPendingEntries } from '@/lib/uploads';
import {
  clearRecentItems,
  getPreferredLanguage,
  getRecentItems,
  getSavedContext,
  openFullPageView,
  getRuntimeUrl,
  setPreferredLanguage,
  setSavedContext,
  storePendingUploads,
  queueActiveTabImagesForFullPage,
} from '@/lib/extension';
import { RecentAltItem } from '@/lib/types';
import { type PlanCode, useSession } from '@/lib/session';
import { PlanBadge } from './components/PlanBadge';
import { Avatar } from './components/Avatar';

const UNLOCKED_SCOPE_LABELS = {
  web: 'Web',
  chrome: 'Chrome',
  shopify: 'Shopify',
  wordpress: 'WordPress',
} as const;

interface ApiResult<T> {
  data?: T;
  error?: string;
}

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
  const [message, setMessage] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const prevSessionStatus = useRef(session.status);
  const activeUserId = session.status === 'signedIn' ? String(session.auth?.userId || '') : '';
  const { preparedRecents, clearRecents } = useRecentItems(activeUserId, session.status === 'signedIn');
  const unlockedScopes = useMemo(() => {
    if (entitlements?.all) return ['All products'];
    return (Object.keys(UNLOCKED_SCOPE_LABELS) as Array<keyof typeof UNLOCKED_SCOPE_LABELS>)
      .filter((scope) => Boolean(entitlements?.[scope]))
      .map((scope) => UNLOCKED_SCOPE_LABELS[scope]);
  }, [entitlements]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [lang, ctx] = await Promise.all([
        getPreferredLanguage().catch(() => ''),
        getSavedContext().catch(() => ''),
      ]);
      if (!mounted) return;
      setLanguage(lang || '');
      setContext(ctx || '');
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
      const entries = await filesToPendingEntries(files);
      if (!entries.length) return;
      await Promise.all([
        storePendingUploads(entries, { language, context }),
        setPreferredLanguage(language || ''),
        setSavedContext(context || ''),
      ]);
      await openFullPageAndClose();
    },
    [language, context, openFullPageAndClose],
  );

  const handleOpenFullPage = useCallback(async () => {
    await Promise.all([
      setPreferredLanguage(language || ''),
      setSavedContext(context || ''),
    ]);
    await openFullPageAndClose();
  }, [language, context, openFullPageAndClose]);

  const handleGenerateCurrentPage = useCallback(async () => {
    await Promise.all([
      setPreferredLanguage(language || ''),
      setSavedContext(context || ''),
    ]);
    try {
      const queued = await queueActiveTabImagesForFullPage({ language, context });
      if (!queued) {
        setMessage('No images found on this page.');
        return;
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

  const startAllAccessSubscription = useCallback(async () => {
    await startCheckout('plan_all_access', {
      skipTrial: session.sub?.trialEligible === false,
      preparingMessage: 'Preparing All Access checkout…',
      successMessage: 'All Access checkout opened in a new tab.',
    });
  }, [session.sub?.trialEligible, startCheckout]);

  const openBillingPortal = useCallback(async () => {
    if (!(await ensureSignedIn()) || !baseUrl || !token) return;
    if (!session.sub?.hasStripeCustomer) {
      setMessage('Choose Chrome or All Access to start your first paid subscription.');
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
      if (session.sub?.trialEligible === false) {
        setMessage('Your free trial has already been used. Choose Chrome or All Access to keep generating alt text.');
      } else {
        setMessage('Choose Chrome or All Access above to unlock extension generation.');
      }
      return;
    }
    if (plan === 'trial' && !session.sub?.hasStripeCustomer) {
      setMessage('You’re still on your free trial. Select Chrome or All Access to start your paid subscription immediately.');
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
  const avatarUrl = session.status === 'signedIn' ? session.auth?.avatarUrl ?? null : null;
  const hasStripeCustomer = session.status === 'signedIn' ? Boolean(session.sub?.hasStripeCustomer) : false;

  const disabledMessage = useMemo(() => {
    if (session.status === 'loading') return 'Loading session…';
    if (session.status !== 'signedIn') return 'Sign in to start your free trial and generate alt text.';
    if (!hasAccess) return 'Your current account does not include Chrome generation. Upgrade to Chrome or All Access.';
    return undefined;
  }, [session.status, hasAccess]);

  return (
    <div className="w-[500px] min-h-[600px] text-foreground" style={{ background: '#f8fbff' }}>
      <div
        className="flex items-center gap-3 px-6 py-4 border-b select-none"
        style={{
          borderColor: '#dbeafe',
          background: '#ffffff',
        }}
        onClick={handleDebugToggle}
      >
        <img src={getRuntimeUrl('icons/icon-32.png')} alt="Alt Text Generator" className="w-7 h-7 rounded-md" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <h1 className="text-lg font-semibold" style={{ lineHeight: 1.1, letterSpacing: '-0.01em', color: '#0b1b44' }}>
            Alt Text Generator
          </h1>
          <p className="text-xs text-muted-foreground">Generate high-quality image descriptions</p>
        </div>
        {showDebug && (
          <Badge variant="outline" className="ml-auto">
            Debug
          </Badge>
        )}
      </div>

      <div className="p-6 space-y-5">
        <div
          className="rounded-xl border p-4 space-y-3 shadow-sm"
          style={{
            borderColor: '#dbeafe',
            background: '#ffffff',
            boxShadow: '0 2px 12px rgba(30, 58, 138, 0.06)',
          }}
        >
          {session.status === 'signedIn' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar url={avatarUrl ?? undefined} name={authDisplayName} tone={plan} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p className="text-sm font-semibold text-foreground">Signed in</p>
                      <PlanBadge plan={plan} trialEndsAt={session.sub?.trialEndsAt} />
                    </div>
                    <p className="text-sm text-muted-foreground">{authDisplayName}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {plan === 'free' && session.sub?.trialEligible !== false && (
                    <Button variant="outline" size="sm" onClick={startTrial}>
                      Start Chrome trial
                    </Button>
                  )}
                  {(plan === 'free' || (plan === 'trial' && !hasStripeCustomer)) && (
                    <Button
                      size="sm"
                      onClick={startChromeSubscription}
                      style={{
                        backgroundColor: '#0b1b44',
                        color: '#ffffff',
                        border: '1px solid #0b1b44',
                        borderRadius: 12,
                      }}
                    >
                      Subscribe Chrome
                    </Button>
                  )}
                  {(plan === 'free' || (plan === 'trial' && !hasStripeCustomer)) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startAllAccessSubscription}
                    >
                      Get All Access
                    </Button>
                  )}
                  {(plan === 'trial' && hasStripeCustomer) || plan === 'paid' ? (
                    <Button
                      size="sm"
                      onClick={openBillingPortal}
                      style={{
                        backgroundColor: '#0b1b44',
                        color: '#ffffff',
                        border: '1px solid #0b1b44',
                        borderRadius: 12,
                      }}
                    >
                      Manage subscription
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    style={{ color: '#dc2626', paddingInline: 8 }}
                  >
                    Sign out
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">{session.auth?.email}</div>
              <div className="flex flex-wrap gap-2">
                {unlockedScopes.length ? (
                  unlockedScopes.map((scope) => (
                    <Badge key={scope} variant="outline">
                      {scope}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No product entitlements yet.</span>
                )}
              </div>

              {session.sub?.renewsAt && plan === 'paid' && (
                <p className="text-xs text-muted-foreground">Renews on {new Date(session.sub.renewsAt).toLocaleDateString()}</p>
              )}
              {plan === 'free' && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {session.sub?.trialEligible === false
                    ? 'You’ve already used your 3-day trial with this account. Choose Chrome or All Access to keep generating alt text.'
                    : 'Use the same account across web and Chrome. Start a Chrome trial, subscribe to Chrome, or choose All Access.'}
                </div>
              )}
              {plan === 'trial' && !hasStripeCustomer && (
                <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                  You’re on a free trial. Keep using it, or choose Chrome or All Access to begin your paid subscription immediately.
                </div>
              )}
              {!hasAccess && session.status === 'signedIn' && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  This account is signed in, but Chrome generation is not unlocked. Web-only access is valid for the web app but not for the extension.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-700">
                  Sign in with the same Alt Text Generator Pro account you use on the web. Billing and entitlements are shared across clients.
                </p>
                <Badge variant="outline">You&apos;re signed out</Badge>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSignIn}
                  disabled={session.status === 'loading'}
                  style={{
                    backgroundColor: '#0b1b44',
                    color: '#ffffff',
                    border: '1px solid #0b1b44',
                  }}
                >
                  {session.status === 'loading' ? 'Opening sign-in…' : 'Sign in'}
                </Button>
              </div>
            </>
          )}
          {error && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={retry}>
                Retry
              </Button>
            </div>
          )}
          {message && (
            <div className="text-sm rounded-md border px-3 py-2" style={{ background: '#eef2ff', borderColor: '#c7d2fe', color: '#3730a3' }}>
              {message}
            </div>
          )}
        </div>

        {session.status === 'signedIn' && preparedRecents.length > 0 && (
          <RecentImage items={preparedRecents} onClear={clearRecents} />
        )}

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
          onFilesSelected={handleFilesSelected}
          onOpenFullPage={handleOpenFullPage}
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

        {showDebug && (
          <div className="rounded-lg border bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
            <div>
              <strong>Base:</strong> {baseUrl ?? 'resolving…'}
            </div>
            {session.status === 'signedIn' && session.auth && (
              <>
                <div>
                  <strong>Token expires:</strong> {new Date(session.auth.expiresAt).toLocaleString()}
                </div>
                <div>
                  <strong>Plan:</strong> {JSON.stringify(session.sub ?? null)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <Toaster richColors position="top-center" />
    </div>
  );
}
