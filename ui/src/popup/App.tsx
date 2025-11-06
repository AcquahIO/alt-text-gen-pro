import { useCallback, useEffect, useMemo, useState, type MouseEventHandler } from 'react';
import { RecentImage } from '@/components/RecentImage';
import { UploadSection } from '@/components/UploadSection';
import { Separator } from '@/components/ui/separator';
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
} from '@/lib/extension';
import { RecentAltItem } from '@/lib/types';
import { useSession } from '@/lib/session';
import { PlanBadge } from './components/PlanBadge';
import { Avatar } from './components/Avatar';

const MAX_RECENTS = 8;

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

function useRecentItems() {
  const [recentItems, setRecentItems] = useState<RecentAltItem[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const recents = await getRecentItems().catch(() => []);
      if (!mounted) return;
      setRecentItems(recents.slice(0, MAX_RECENTS));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const preparedRecents = useMemo(
    () =>
      recentItems.map((item, index) => ({
        ...item,
        id: `${item.srcUrl || item.altText}-${index}`,
      })),
    [recentItems],
  );

  const clearRecents = useCallback(async () => {
    await clearRecentItems();
    setRecentItems([]);
  }, []);

  return { preparedRecents, clearRecents };
}

export default function PopupApp() {
  const { session, signIn, signOut, error, retry, baseUrl } = useSession();
  const token = session.status === 'signedIn' ? session.auth?.token ?? '' : '';
  const plan = session.status === 'signedIn' ? session.sub?.plan ?? 'free' : 'free';
  const hasAccess = session.status === 'signedIn' && (plan === 'trial' || plan === 'paid');

  const [language, setLanguage] = useState('');
  const [context, setContext] = useState('');
  const [message, setMessage] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const { preparedRecents, clearRecents } = useRecentItems();

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

  const ensureSignedIn = useCallback(async () => {
    if (session.status === 'signedIn') return true;
    try {
      await signIn();
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Sign-in cancelled');
      return false;
    }
  }, [session.status, signIn]);

  const startTrial = useCallback(async () => {
    if (session.status === 'signedIn' && session.sub?.trialEligible === false) {
      setMessage('You have already used your free trial. Subscribe now to continue using Alt Text Generator Pro.');
      return;
    }
    if (!(await ensureSignedIn()) || !baseUrl || !token) return;
    setMessage('Preparing checkout…');
    const result = await callAuthorizedApi<{ url: string }>(baseUrl, token, '/api/create-checkout-session', {
      method: 'POST',
    });
    if (result.error || !result.data) {
      setMessage(result.error ?? 'Unable to create checkout session');
      return;
    }
    if (chrome?.tabs?.create) {
      await chrome.tabs.create({ url: result.data.url });
    } else {
      window.open(result.data.url, '_blank');
    }
    setMessage('Checkout opened in a new tab.');
  }, [baseUrl, token, ensureSignedIn, session.status, session.sub?.trialEligible]);

  const startSubscriptionNow = useCallback(async () => {
    if (!(await ensureSignedIn()) || !baseUrl || !token) return;
    setMessage('Preparing subscription checkout…');
    const result = await callAuthorizedApi<{ url: string }>(baseUrl, token, '/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ skipTrial: true }),
    });
    if (result.error || !result.data) {
      setMessage(result.error ?? 'Unable to start subscription');
      return;
    }
    if (chrome?.tabs?.create) {
      await chrome.tabs.create({ url: result.data.url });
    } else {
      window.open(result.data.url, '_blank');
    }
    setMessage('Subscription checkout opened in a new tab.');
  }, [baseUrl, token, ensureSignedIn]);

  const openBillingPortal = useCallback(async () => {
    if (!(await ensureSignedIn()) || !baseUrl || !token) return;
    if (!session.sub?.hasStripeCustomer) {
      setMessage('You are still on a free trial. Choose “Subscribe now” to start your subscription immediately.');
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
        setMessage('Your free trial has already been used. Choose “Subscribe now” to keep generating alt text.');
      } else {
        setMessage('Choose “Start free trial” or “Subscribe now” above to unlock full access.');
      }
      return;
    }
    if (plan === 'trial' && !session.sub?.hasStripeCustomer) {
      setMessage('You’re still on your free trial. Select “Subscribe now” to start your subscription immediately.');
      return;
    }
    await openBillingPortal();
  }, [plan, openBillingPortal, session.sub?.hasStripeCustomer, session.sub?.trialEligible, setMessage]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setMessage('Signed out.');
  }, [signOut]);

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
    if (!hasAccess) return 'Upgrade your plan to continue generating alt text.';
    return undefined;
  }, [session.status, hasAccess]);

  return (
    <div className="w-[500px] min-h-[600px] bg-background text-foreground">
      <div className="flex items-center gap-2 px-6 py-4 border-b select-none" onClick={handleDebugToggle}>
        <img src={getRuntimeUrl('icons/icon32.png')} alt="Alt Text Generator" className="w-6 h-6 rounded-md" />
        <h1 className="text-lg font-semibold">Alt Text Generator</h1>
        {showDebug && (
          <Badge variant="outline" className="ml-auto">
            Debug
          </Badge>
        )}
      </div>

      <div className="p-6 space-y-6">
        <div className="rounded-lg border bg-white shadow-sm p-4 space-y-3">
          {session.status === 'signedIn' ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar url={avatarUrl ?? undefined} name={authDisplayName} />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">Signed in</p>
                    <p className="text-sm text-muted-foreground">{authDisplayName}</p>
                  </div>
                </div>
                <PlanBadge plan={plan} trialEndsAt={session.sub?.trialEndsAt} />
              </div>
              {session.sub?.renewsAt && plan === 'paid' && (
                <p className="text-xs text-muted-foreground">Renews on {new Date(session.sub.renewsAt).toLocaleDateString()}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {plan === 'free' && (
                  <>
                    <Button variant="outline" onClick={startTrial}>
                      Start free trial
                    </Button>
                    <Button variant="outline" onClick={startSubscriptionNow}>
                      Subscribe now
                    </Button>
                  </>
                )}
                {plan === 'trial' && !hasStripeCustomer && (
                  <Button variant="outline" onClick={startSubscriptionNow}>
                    Subscribe now
                  </Button>
                )}
                {plan === 'trial' && hasStripeCustomer && (
                  <Button variant="outline" onClick={openBillingPortal}>
                    Manage subscription
                  </Button>
                )}
                {plan === 'paid' && (
                  <Button variant="outline" onClick={openBillingPortal}>
                    Manage subscription
                  </Button>
                )}
                <Button variant="ghost" onClick={handleSignOut}>
                  Sign out
                </Button>
              </div>
              {plan === 'free' && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {session.sub?.trialEligible === false
                    ? 'You’ve already used your 3-day trial with this account. Subscribe now to keep generating alt text.'
                    : 'Start a 3-day trial to test everything first, or subscribe right away if you’re ready.'}
                </div>
              )}
              {plan === 'trial' && !hasStripeCustomer && (
                <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                  You’re on a free trial. Keep using it, or choose “Subscribe now” to skip the remaining days and begin your paid subscription immediately.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-700">
                  Sign in with Google to continue. You can start a 3-day free trial during sign-up and cancel anytime from the billing portal.
                </p>
                <Badge variant="outline">You&apos;re signed out</Badge>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={signIn} disabled={session.status === 'loading'}>
                  {session.status === 'loading' ? 'Opening sign-in…' : 'Sign in with Google'}
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
          {message && <div className="text-sm text-indigo-700">{message}</div>}
        </div>

        {preparedRecents.length > 0 && (
          <>
            <RecentImage items={preparedRecents} onClear={clearRecents} />
            <Separator />
          </>
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
