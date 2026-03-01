import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAppBaseUrl } from './env';
import { getLocal, removeLocal, setLocal } from './extension';

export type Plan = 'free' | 'trial' | 'paid';
export type ClientScope = 'web' | 'chrome' | 'shopify' | 'wordpress';
export type PlanCode =
  | 'plan_web'
  | 'plan_chrome'
  | 'plan_shopify'
  | 'plan_wordpress'
  | 'plan_all_access';

export interface EntitlementMatrix {
  all: boolean;
  web: boolean;
  chrome: boolean;
  shopify: boolean;
  wordpress: boolean;
}

export interface BillingCatalogEntry {
  planCode: PlanCode;
  title: string;
  scope: ClientScope | 'all';
  unlockedScopes: Array<ClientScope | 'all'>;
  purchaseEnabled: boolean;
  current: boolean;
}

export interface SubscriptionStatus {
  plan: Plan;
  activePlanCode?: PlanCode | null;
  currentSubscriptionStatus?: string | null;
  trialEndsAt?: string | null;
  renewsAt?: string | null;
  providerPortalUrl?: string | null;
  hasStripeCustomer?: boolean;
  trialEligible?: boolean;
  entitlements?: Partial<EntitlementMatrix>;
  catalog?: BillingCatalogEntry[];
}

export interface AuthState {
  token: string;
  expiresAt: number;
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface Session {
  status: 'signedOut' | 'loading' | 'signedIn';
  auth?: AuthState;
  sub?: SubscriptionStatus;
}

export interface SessionHook {
  session: Session;
  baseUrl: string | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => Promise<void>;
}

const AUTH_STORAGE_KEY = 'auth';
const CLOCK_SKEW_MS = 30_000; // Trim 30s to account for clock drift.

function bufferDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  if (typeof atob === 'function') {
    return atob(padded);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('binary');
  }
  throw new Error('Base64 decoding not supported in this environment.');
}

function decodeJwt(token: string): { exp?: number; name?: string; picture?: string } {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const payload = bufferDecode(parts[1]);
    return JSON.parse(payload);
  } catch (err) {
    console.warn('Unable to decode JWT payload', err);
    return {};
  }
}

export function isExpired(auth: AuthState | null | undefined): boolean {
  if (!auth) return true;
  return Date.now() + CLOCK_SKEW_MS >= auth.expiresAt;
}

export async function readAuth(): Promise<AuthState | null> {
  const result = await getLocal<{ auth?: AuthState | null }>({ auth: null });
  const auth = result?.auth ?? null;
  if (!auth) return null;
  return auth;
}

export async function saveAuth(auth: AuthState): Promise<void> {
  await setLocal({ [AUTH_STORAGE_KEY]: auth });
}

export async function clearAuth(): Promise<void> {
  await removeLocal([AUTH_STORAGE_KEY]);
}

export async function fetchSubscriptionStatus(baseUrl: string, token: string): Promise<SubscriptionStatus> {
  const res = await fetch(`${baseUrl}/api/subscription-status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error((payload as { error?: string } | null)?.error ?? `Failed to load subscription status (${res.status})`);
  }
  return (await res.json()) as SubscriptionStatus;
}

export async function exchangeLoginCode(
  baseUrl: string,
  code: string,
): Promise<{ token: string; expiresAt: number; userId: string; email: string; displayName?: string; avatarUrl?: string | null }> {
  const res = await fetch(`${baseUrl}/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error((payload as { error?: string } | null)?.error ?? `Auth exchange failed (${res.status})`);
  }
  const data = (await res.json()) as {
    accessToken: string;
    user: { id: string; email: string; displayName?: string; avatarUrl?: string | null };
  };

  const decoded = decodeJwt(data.accessToken);
  const expiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + 55 * 60 * 1000;

  return {
    token: data.accessToken,
    expiresAt,
    userId: data.user.id,
    email: data.user.email,
    displayName: data.user.displayName ?? decoded?.name,
    avatarUrl: data.user.avatarUrl ?? decoded?.picture ?? null,
  };
}

function randomState(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function assertChromeIdentity(): asserts chrome is typeof chrome {
  if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
    throw new Error('Chrome identity API is unavailable in this context.');
  }
}

export function useSession(): SessionHook {
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestAuth = useRef<AuthState | null>(null);

  const load = useCallback(async () => {
    const resolvedBase = await getAppBaseUrl();
    setBaseUrl(resolvedBase);
    const stored = await readAuth();
    if (!stored || isExpired(stored)) {
      if (stored) await clearAuth();
      latestAuth.current = null;
      setSession({ status: 'signedOut' });
      return;
    }

    try {
      setSession({ status: 'loading', auth: stored });
      const sub = await fetchSubscriptionStatus(resolvedBase, stored.token);
      latestAuth.current = stored;
      setSession({ status: 'signedIn', auth: stored, sub });
      setError(null);
    } catch (err) {
      console.warn('Subscription status fetch failed', err);
      if (err instanceof Error && /user not found/i.test(err.message)) {
        await clearAuth();
        latestAuth.current = null;
        setSession({ status: 'signedOut' });
        setError('We could not find your account. Please sign in again.');
        return;
      }
      setSession({ status: 'signedIn', auth: stored });
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const retry = useCallback(async () => {
    if (!baseUrl || !latestAuth.current) {
      await load();
      return;
    }
    try {
      const sub = await fetchSubscriptionStatus(baseUrl, latestAuth.current.token);
      setSession({ status: 'signedIn', auth: latestAuth.current, sub });
      setError(null);
    } catch (err) {
      if (err instanceof Error && /user not found/i.test(err.message)) {
        await clearAuth();
        latestAuth.current = null;
        setSession({ status: 'signedOut' });
        setError('We could not find your account. Please sign in again.');
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [baseUrl, load]);

  const signIn = useCallback(async () => {
    assertChromeIdentity();
    setSession({ status: 'loading' });
    try {
      const resolvedBase = baseUrl ?? (await getAppBaseUrl());
      setBaseUrl(resolvedBase);
      const redirectUri = chrome.identity.getRedirectURL('auth/cb');
      const state = randomState();
      const authUrl = `${resolvedBase}/auth/start?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

      const responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
      if (!responseUrl) throw new Error('Authentication cancelled');

      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      if (!code || returnedState !== state) {
        throw new Error('Invalid authentication response');
      }

      const exchanged = await exchangeLoginCode(resolvedBase, code);
      const auth: AuthState = {
        token: exchanged.token,
        expiresAt: exchanged.expiresAt,
        userId: exchanged.userId,
        email: exchanged.email,
        displayName: exchanged.displayName ?? exchanged.email,
        avatarUrl: exchanged.avatarUrl ?? null,
      };

      await saveAuth(auth);
      latestAuth.current = auth;
      const sub = await fetchSubscriptionStatus(resolvedBase, auth.token);
      setSession({ status: 'signedIn', auth, sub });
      setError(null);
    } catch (err) {
      console.warn('Sign-in flow failed', err);
      await clearAuth();
      latestAuth.current = null;
      setSession({ status: 'signedOut' });
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [baseUrl]);

  const signOut = useCallback(async () => {
    await clearAuth();
    latestAuth.current = null;
    setSession({ status: 'signedOut' });
  }, []);

  useEffect(() => {
    function handleMessage(message: unknown, _sender: unknown, sendResponse: (value?: unknown) => void) {
      if (typeof message === 'object' && message && (message as { type?: string }).type === 'stripeCheckoutCompleted') {
        retry().finally(() => sendResponse({ ok: true }));
        return true;
      }
      return undefined;
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => {
        chrome.runtime?.onMessage?.removeListener(handleMessage);
      };
    }
    return () => {};
  }, [retry]);

  return useMemo(
    () => ({ session, baseUrl, error, signIn, signOut, retry }),
    [session, baseUrl, error, signIn, signOut, retry],
  );
}
