import { useCallback, useEffect, useMemo, useState } from 'react';
import { UploadHeader } from '@/components/UploadHeader';
import { ImageResultCard } from '@/components/ImageResultCard';
import { Toaster } from '@/components/ui/sonner';
import brandIcon from '@extension/icons/icon-128.png';
import {
  addRecentItem,
  clearRecentItems,
  consumePendingUploads,
  downloadWithMetadata,
  generateAltTextForImageSource,
  getPreferredLanguage,
  getRecentItems,
  getSavedContext,
  getSavedFocusKeyword,
  getSavedBrand,
  setPreferredLanguage,
  setSavedContext,
  setSavedFocusKeyword,
  setSavedBrand,
  formatFileSize,
} from '@/lib/extension';
import { entriesToItems, filesToUploadItems } from '@/lib/uploads';
import { getUsageAllowance, useSession } from '@/lib/session';
import { RecentAltItem, UploadItem } from '@/lib/types';
import { AccessGate } from './components/AccessGate';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { toast } from 'sonner';
import { Clock3, ImageIcon, Images, Settings2 } from 'lucide-react';

type FullPageView = 'workspace' | 'history' | 'settings';

interface ApiResult<T> {
  data?: T;
  error?: string;
}

async function callAuthorizedApi<T>(
  baseUrl: string,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  try {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      return {
        error: (payload as { error?: string } | null)?.error ?? `Request failed (${response.status})`,
      };
    }
    return { data: (await response.json()) as T };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function openExternalUrl(url: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    await chrome.tabs.create({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

const COMMAND_PREVIEW = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('preview') === 'command';

const COMMAND_PREVIEW_ITEMS: UploadItem[] = [
  {
    id: 'preview-chair',
    name: 'oak-chair-front.jpg',
    type: 'image/jpeg',
    size: 1180000,
    sourceUrl: '../apps/web/public/assets/seo-alt-text-hero.jpg',
    status: 'done',
    altText: 'Light oak dining chair with a curved backrest in a warm studio setting.',
  },
  {
    id: 'preview-table',
    name: 'oak-side-table.jpg',
    type: 'image/png',
    size: 1320000,
    sourceUrl: '../apps/web/public/assets/oak-side-table-studio.jpg',
    status: 'done',
    altText: 'Round oak side table with a lower shelf styled in a softly lit neutral room.',
  },
  {
    id: 'preview-bowl',
    name: 'pear-bowl.jpg',
    type: 'image/png',
    size: 1270000,
    sourceUrl: '../apps/web/public/assets/pear-bowl-studio.jpg',
    status: 'done',
    altText: 'Ceramic bowl of green pears on a pale oak table in a minimal studio scene.',
  },
];

const COMMAND_PREVIEW_HISTORY: RecentAltItem[] = COMMAND_PREVIEW_ITEMS.map((item, index) => ({
  srcUrl: item.sourceUrl || '',
  altText: item.altText,
  pageTitle: 'North & Pine product catalogue',
  when: Date.now() - index * 19 * 60 * 1000,
}));

export default function FullPageApp() {
  const { session, signIn, signOut, retry, error: sessionError, baseUrl } = useSession();
  const isSignedIn = session.status === 'signedIn';
  const authToken = isSignedIn ? session.auth?.token ?? '' : '';
  const activeUserId = isSignedIn ? session.auth?.userId ?? '' : '';
  const entitlements = isSignedIn ? session.sub?.entitlements : undefined;
  const hasChromeAccess = isSignedIn && Boolean(entitlements?.all || entitlements?.chrome);
  const monthlyAllowance = isSignedIn ? getUsageAllowance(session.sub, 'month') : null;
  const billingIssue = isSignedIn ? session.sub?.billingIssue ?? null : null;
  const hasStripeCustomer = isSignedIn ? Boolean(session.sub?.hasStripeCustomer) : false;
  const plan = isSignedIn ? session.sub?.plan ?? 'free' : 'free';

  const [items, setItems] = useState<UploadItem[]>(() => COMMAND_PREVIEW ? COMMAND_PREVIEW_ITEMS : []);
  const [language, setLanguage] = useState(COMMAND_PREVIEW ? '' : '');
  const [context, setContext] = useState(COMMAND_PREVIEW ? 'Solid oak dining chair · North & Pine' : '');
  const [focusKeyword, setFocusKeyword] = useState(COMMAND_PREVIEW ? 'oak dining chair' : '');
  const [brand, setBrand] = useState(COMMAND_PREVIEW ? 'North & Pine' : '');
  const [generatingAll, setGeneratingAll] = useState(false);
  const [activeView, setActiveView] = useState<FullPageView>('workspace');
  const [historyItems, setHistoryItems] = useState<RecentAltItem[]>(() => COMMAND_PREVIEW ? COMMAND_PREVIEW_HISTORY : []);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (COMMAND_PREVIEW) return;
      const [pending, storedLang, storedCtx, storedKeyword, storedBrand] = await Promise.all([
        consumePendingUploads().catch(() => null),
        getPreferredLanguage().catch(() => ''),
        getSavedContext().catch(() => ''),
        getSavedFocusKeyword().catch(() => ''),
        getSavedBrand().catch(() => ''),
      ]);
      if (!mounted) return;
      const initialItems = entriesToItems(pending?.entries || []);
      setItems(initialItems);
      setLanguage((pending?.language ?? storedLang ?? '').toString());
      setContext((pending?.context ?? storedCtx ?? '').toString());
      setFocusKeyword((pending?.focusKeyword ?? storedKeyword ?? '').toString());
      setBrand((pending?.brand ?? storedBrand ?? '').toString());
      if (pending?.notice) toast.info(pending.notice);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadHistory = useCallback(async () => {
    if (COMMAND_PREVIEW) {
      setHistoryItems(COMMAND_PREVIEW_HISTORY);
      return;
    }
    if (!activeUserId) {
      setHistoryItems([]);
      return;
    }
    setHistoryLoading(true);
    try {
      setHistoryItems(await getRecentItems(activeUserId));
    } catch {
      toast.error('History could not be loaded');
    } finally {
      setHistoryLoading(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    if (activeView === 'history') {
      void loadHistory();
    }
  }, [activeView, loadHistory]);

  const handleAddFiles = useCallback(async (files: FileList) => {
    if (!files.length) return;
    const newItems = await filesToUploadItems(files);
    setItems((current) => [...newItems, ...current]);
  }, []);

  const updateItem = useCallback((id: string, updater: (item: UploadItem) => UploadItem) => {
    setItems((current) => current.map((item) => (item.id === id ? updater(item) : item)));
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const handleClearItems = useCallback(() => {
    setItems([]);
  }, []);

  const generateItem = useCallback(
    async (id: string) => {
      if (!hasChromeAccess) {
        setActiveView('workspace');
        toast.error('Sign in and activate Chrome access before generating alt text.');
        return;
      }
      const snapshot = items.find((item) => item.id === id);
      if (!snapshot) return;
      setItems((current) => current.map((item) => (
        item.id === id ? { ...item, status: 'generating', error: undefined } : item
      )));
      try {
        const { altText } = await generateAltTextForImageSource(snapshot, {
          pageContext: context,
          focusKeyword,
          brand,
        });
        const generatedAt = Date.now();
        updateItem(id, (item) => ({ ...item, altText, status: 'done', error: undefined, generatedAt }));
        if (activeUserId && altText) {
          await addRecentItem(activeUserId, {
            srcUrl: snapshot.sourceUrl || '',
            altText,
            pageTitle: snapshot.name,
            when: generatedAt,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateItem(id, (item) => ({ ...item, status: 'error', error: message }));
        toast.error(message || 'Generation failed');
      }
    },
    [activeUserId, brand, context, focusKeyword, hasChromeAccess, items, updateItem],
  );

  const handleGenerateItem = useCallback(async (id: string) => {
    await generateItem(id);
    await retry();
  }, [generateItem, retry]);

  const handleAltTextChange = useCallback((id: string, value: string) => {
    updateItem(id, (item) => ({
      ...item,
      altText: value,
      status: value.trim() ? 'done' : 'ready',
      error: undefined,
    }));
  }, [updateItem]);

  const handleGenerateAll = useCallback(async () => {
    if (!items.length) return;
    setGeneratingAll(true);
    try {
      const pending = items.filter((item) => !(item.status === 'done' && item.altText));
      const queue = [...pending];
      await Promise.all(
        Array.from({ length: Math.min(3, queue.length) }, async () => {
          while (queue.length) {
            const item = queue.shift();
            if (item) await generateItem(item.id);
          }
        }),
      );
      await retry();
    } finally {
      setGeneratingAll(false);
    }
  }, [items, generateItem, retry]);

  const handleCopy = useCallback(async (item: UploadItem) => {
    if (!item.altText) return;
    try {
      await navigator.clipboard.writeText(item.altText);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Copy failed');
    }
  }, []);

  const handleDownload = useCallback(async (item: UploadItem) => {
    if (!item.altText) return;
    try {
      const result = await downloadWithMetadata(item, item.altText);
      if (result.metadataEmbedded) {
        toast.success('Downloaded in the original format with metadata');
      } else {
        toast.warning(result.reason || 'Downloaded unchanged; this format does not support embedded metadata.');
      }
    } catch (error) {
      toast.error('Download failed');
    }
  }, []);

  const handleLanguageChange = useCallback(async (value: string) => {
    setLanguage(value);
    await setPreferredLanguage(value);
  }, []);

  const handleContextChange = useCallback(async (value: string) => {
    setContext(value);
    await setSavedContext(value);
  }, []);

  const handleFocusKeywordChange = useCallback(async (value: string) => {
    setFocusKeyword(value);
    await setSavedFocusKeyword(value);
  }, []);

  const handleBrandChange = useCallback(async (value: string) => {
    setBrand(value);
    await setSavedBrand(value);
  }, []);

  const handleSignIn = useCallback(async () => {
    setAccountBusy(true);
    try {
      await signIn();
      toast.success('Signed in');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sign in was not completed');
    } finally {
      setAccountBusy(false);
    }
  }, [signIn]);

  const handleSignOut = useCallback(async () => {
    setAccountBusy(true);
    try {
      await signOut();
      setHistoryItems([]);
      setActiveView('workspace');
      toast.success('Signed out');
    } finally {
      setAccountBusy(false);
    }
  }, [signOut]);

  const handleRetrySession = useCallback(async () => {
    setAccountBusy(true);
    try {
      await retry();
    } finally {
      setAccountBusy(false);
    }
  }, [retry]);

  const startChromeCheckout = useCallback(async (skipTrial: boolean) => {
    if (!baseUrl || !authToken) {
      toast.error('Sign in before starting checkout.');
      return;
    }
    if (!skipTrial && session.sub?.trialEligible === false) {
      toast.error('The free trial has already been used on this account.');
      return;
    }

    setAccountBusy(true);
    try {
      const result = await callAuthorizedApi<{ url: string }>(baseUrl, authToken, '/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          planCode: 'plan_chrome',
          ...(skipTrial ? { skipTrial: true } : {}),
        }),
      });
      if (result.error || !result.data?.url) {
        toast.error(result.error || 'Checkout could not be started');
        return;
      }
      await openExternalUrl(result.data.url);
      toast.success(skipTrial ? 'Chrome subscription checkout opened' : 'Chrome trial checkout opened');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Checkout could not be opened');
    } finally {
      setAccountBusy(false);
    }
  }, [authToken, baseUrl, session.sub?.trialEligible]);

  const handleManageBilling = useCallback(async () => {
    if (!baseUrl || !authToken) {
      toast.error('Sign in before opening billing.');
      return;
    }
    setAccountBusy(true);
    try {
      if (session.sub?.providerPortalUrl) {
        await openExternalUrl(session.sub.providerPortalUrl);
        return;
      }
      const result = await callAuthorizedApi<{ url: string }>(baseUrl, authToken, '/api/create-portal-session', {
        method: 'POST',
      });
      if (result.error || !result.data?.url) {
        toast.error(result.error || 'Billing could not be opened');
        return;
      }
      await openExternalUrl(result.data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Billing could not be opened');
    } finally {
      setAccountBusy(false);
    }
  }, [authToken, baseUrl, session.sub?.providerPortalUrl]);

  const handleClearHistory = useCallback(async () => {
    if (COMMAND_PREVIEW) {
      setHistoryItems([]);
      return;
    }
    if (!activeUserId) return;
    await clearRecentItems(activeUserId);
    setHistoryItems([]);
    toast.success('History cleared');
  }, [activeUserId]);

  const handleResetSettings = useCallback(async () => {
    await Promise.all([
      handleLanguageChange(''),
      handleContextChange(''),
      handleFocusKeywordChange(''),
      handleBrandChange(''),
    ]);
    toast.success('Generation defaults reset');
  }, [handleBrandChange, handleContextChange, handleFocusKeywordChange, handleLanguageChange]);

  const renderedItems = useMemo(() => items, [items]);
  const iconSrc = brandIcon;
  const accountStatus = billingIssue
    ? billingIssue.title
    : session.status === 'loading'
      ? 'Checking account status'
      : !isSignedIn
        ? 'Sign in to connect Chrome access'
        : plan === 'trial'
          ? 'Chrome trial active'
          : hasChromeAccess
            ? 'Chrome subscription active'
            : 'Chrome access not active';

  return (
    <div className="command-shell">
      <header className="command-page-header">
        <div className="command-page-header__inner">
          <div className="command-brand">
            <img src={iconSrc} alt="Alt Text Generator" className="command-brand__icon" />
            <div className="command-brand__copy">
              <h1 className="command-brand__title">Alt Text Generator Pro</h1>
            </div>
          </div>
          <div className="command-page-header__status">
            {monthlyAllowance ? (
              <div className="command-page-allowance">
                <div className="command-page-allowance__copy">
                  <span>Monthly allowance</span>
                  <strong>{monthlyAllowance.used.toLocaleString()} / {monthlyAllowance.limit.toLocaleString()}</strong>
                  <b>{monthlyAllowance.remaining.toLocaleString()} left</b>
                </div>
                <div
                  className="command-page-allowance__track"
                  role="progressbar"
                  aria-label="Monthly generation allowance used"
                  aria-valuemin={0}
                  aria-valuemax={monthlyAllowance.limit}
                  aria-valuenow={Math.min(monthlyAllowance.used, monthlyAllowance.limit)}
                >
                  <span style={{ width: `${monthlyAllowance.percentUsed}%` }} />
                </div>
              </div>
            ) : (
              <span className="command-page-access-status">
                {session.status === 'loading'
                  ? 'Checking allowance…'
                  : isSignedIn && hasChromeAccess
                    ? 'Allowance unavailable'
                    : isSignedIn
                      ? 'Chrome access required'
                      : 'Signed out'}
              </span>
            )}
            <span className="command-page-count">
              <span className="command-ready-dot" />
              {items.length} image{items.length === 1 ? '' : 's'} queued
            </span>
          </div>
        </div>
      </header>

      <main className="command-page-main">
        <nav className="command-page-nav" aria-label="Extension views">
          <button
            type="button"
            className={activeView === 'workspace' ? 'command-page-nav__item command-page-nav__item--active' : 'command-page-nav__item'}
            onClick={() => setActiveView('workspace')}
            aria-current={activeView === 'workspace' ? 'page' : undefined}
          >
            <Images size={16} />
            Workspace
          </button>
          <button
            type="button"
            className={activeView === 'history' ? 'command-page-nav__item command-page-nav__item--active' : 'command-page-nav__item'}
            onClick={() => setActiveView('history')}
            aria-current={activeView === 'history' ? 'page' : undefined}
          >
            <Clock3 size={16} />
            History
          </button>
          <button
            type="button"
            className={activeView === 'settings' ? 'command-page-nav__item command-page-nav__item--active' : 'command-page-nav__item'}
            onClick={() => setActiveView('settings')}
            aria-current={activeView === 'settings' ? 'page' : undefined}
          >
            <Settings2 size={16} />
            Settings
          </button>
        </nav>

        {activeView === 'workspace' ? (
          hasChromeAccess ? (
            <div className="command-page-stage">
              <UploadHeader
                language={language}
                onLanguageChange={handleLanguageChange}
                context={context}
                onContextChange={handleContextChange}
                focusKeyword={focusKeyword}
                onFocusKeywordChange={handleFocusKeywordChange}
                brand={brand}
                onBrandChange={handleBrandChange}
                onAddFiles={handleAddFiles}
                onGenerateAll={handleGenerateAll}
                onRemove={handleRemoveItem}
                onClear={handleClearItems}
                busy={generatingAll}
                items={items}
              />

              {renderedItems.length > 0 ? (
                <section className="command-results" aria-labelledby="workspace-results-heading">
                  <div className="command-results__header">
                    <div>
                      <h2 id="workspace-results-heading" className="command-results__title">Generated alt text</h2>
                      <p className="command-results__subtitle">Review, copy, or download each result with metadata.</p>
                    </div>
                    <span className="command-shortcut">{renderedItems.filter((item) => item.status === 'done').length}/{renderedItems.length} complete</span>
                  </div>
                  {renderedItems.map((item) => (
                    <ImageResultCard
                      key={item.id}
                      item={item}
                      fileSizeLabel={formatFileSize(item.size)}
                      onGenerate={() => handleGenerateItem(item.id)}
                      onAltTextChange={(value) => handleAltTextChange(item.id, value)}
                      onCopy={() => handleCopy(item)}
                      onDownload={() => handleDownload(item)}
                      onRemove={() => handleRemoveItem(item.id)}
                    />
                  ))}
                </section>
              ) : (
                <div className="command-empty-workspace">
                  <div className="command-empty-workspace__inner">
                    <span className="command-empty-workspace__icon"><ImageIcon size={21} strokeWidth={1.7} /></span>
                    <h2 className="command-empty-workspace__title">Your queue is empty</h2>
                    <p className="command-empty-workspace__body">Upload images above, or return to the extension popup to scan the page you are working on.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <AccessGate
              sessionStatus={session.status}
              trialEligible={session.sub?.trialEligible}
              billingIssue={billingIssue}
              hasStripeCustomer={hasStripeCustomer}
              busy={accountBusy}
              error={sessionError}
              onSignIn={handleSignIn}
              onStartTrial={() => startChromeCheckout(false)}
              onSubscribe={() => startChromeCheckout(true)}
              onManageBilling={handleManageBilling}
              onRetry={handleRetrySession}
            />
          )
        ) : activeView === 'history' ? (
          <HistoryView
            items={historyItems}
            loading={historyLoading}
            signedIn={isSignedIn}
            onSignIn={handleSignIn}
            onRefresh={loadHistory}
            onClear={handleClearHistory}
          />
        ) : (
          <SettingsView
            language={language}
            context={context}
            focusKeyword={focusKeyword}
            brand={brand}
            signedIn={isSignedIn}
            email={session.auth?.email}
            accountStatus={accountStatus}
            onLanguageChange={handleLanguageChange}
            onContextChange={handleContextChange}
            onFocusKeywordChange={handleFocusKeywordChange}
            onBrandChange={handleBrandChange}
            onReset={handleResetSettings}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
          />
        )}
      </main>
      <Toaster richColors position="top-center" />
    </div>
  );
}
