import { APP_ORIGIN, isExpired } from '@/lib/env';
import { detectLocaleFromPath, getLocaleCookie, getLocaleFromBrowserLanguages } from '@/i18n/config';
import { buildRoutePath } from '@/i18n/routes';
import { AuthState } from '@/lib/types';

const AUTH_STORAGE_KEY = 'atgp_web_auth';
const OAUTH_STATE_KEY = 'atgp_web_oauth_state';
const OAUTH_RETURN_PATH_KEY = 'atgp_web_oauth_return_path';

function decodeJwt(token: string): { exp?: number; name?: string; picture?: string } {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

function randomState(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function readAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed?.token || !parsed?.expiresAt || isExpired(parsed.expiresAt)) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function saveAuth(auth: AuthState): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function beginSignIn(apiBaseUrl: string): void {
  const state = randomState();
  const locale =
    detectLocaleFromPath(window.location.pathname) ??
    getLocaleCookie(document.cookie) ??
    getLocaleFromBrowserLanguages(navigator.languages ?? [navigator.language]);
  const redirectUri = `${APP_ORIGIN}${buildRoutePath(locale, 'authCallback')}`;
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  sessionStorage.setItem(OAUTH_RETURN_PATH_KEY, `${window.location.pathname}${window.location.search}${window.location.hash}`);
  const authUrl = `${apiBaseUrl}/auth/start?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  window.location.assign(authUrl);
}

export function consumePostAuthPath(): string | null {
  const value = sessionStorage.getItem(OAUTH_RETURN_PATH_KEY);
  sessionStorage.removeItem(OAUTH_RETURN_PATH_KEY);
  return value;
}

export async function completeSignInFromCallback(
  apiBaseUrl: string,
  code: string,
  stateFromQuery: string | null,
): Promise<AuthState> {
  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);

  if (!code) {
    throw new Error('Missing login code from callback.');
  }

  if (!expectedState || !stateFromQuery || expectedState !== stateFromQuery) {
    throw new Error('Invalid authentication state. Please retry sign-in.');
  }

  const res = await fetch(`${apiBaseUrl}/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message = (payload as { error?: string } | null)?.error ?? `Auth exchange failed (${res.status})`;
    throw new Error(message);
  }

  const data = (await res.json()) as {
    accessToken: string;
    user: { id: string; email: string; displayName?: string; avatarUrl?: string | null };
  };

  const decoded = decodeJwt(data.accessToken);
  const expiresAt = decoded.exp ? decoded.exp * 1000 : Date.now() + 55 * 60 * 1000;

  const auth: AuthState = {
    token: data.accessToken,
    expiresAt,
    userId: data.user.id,
    email: data.user.email,
    displayName: data.user.displayName ?? decoded.name ?? data.user.email,
    avatarUrl: data.user.avatarUrl ?? decoded.picture ?? null,
  };

  saveAuth(auth);
  return auth;
}
