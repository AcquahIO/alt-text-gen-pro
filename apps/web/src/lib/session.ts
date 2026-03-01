import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { beginSignIn, clearAuth, readAuth } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/env';
import { fetchSubscriptionStatus } from '@/lib/api';
import { AuthState, SessionState } from '@/lib/types';

interface SessionHook {
  session: SessionState;
  error: string | null;
  apiBaseUrl: string;
  refresh: () => Promise<void>;
  startSignIn: () => Promise<void>;
  signOut: () => void;
}

export function useSession(): SessionHook {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const [error, setError] = useState<string | null>(null);
  const latestAuth = useRef<AuthState | null>(null);

  const load = useCallback(async () => {
    const auth = readAuth();
    if (!auth) {
      latestAuth.current = null;
      setSession({ status: 'signedOut' });
      return;
    }

    try {
      setSession({ status: 'loading', auth });
      const sub = await fetchSubscriptionStatus(API_BASE_URL, auth.token);
      latestAuth.current = auth;
      setSession({ status: 'signedIn', auth, sub });
      setError(null);
    } catch (err) {
      if (err instanceof Error && /user not found|expired|invalid/i.test(err.message)) {
        clearAuth();
        latestAuth.current = null;
        setSession({ status: 'signedOut' });
        setError('Your session is no longer valid. Please sign in again.');
        return;
      }
      setSession({ status: 'signedIn', auth });
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load().catch(() => {
      setSession({ status: 'signedOut' });
    });
  }, [load]);

  const refresh = useCallback(async () => {
    const auth = latestAuth.current ?? readAuth();
    if (!auth) {
      setSession({ status: 'signedOut' });
      return;
    }
    try {
      const sub = await fetchSubscriptionStatus(API_BASE_URL, auth.token);
      latestAuth.current = auth;
      setSession({ status: 'signedIn', auth, sub });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const startSignIn = useCallback(async () => {
    beginSignIn(API_BASE_URL);
  }, []);

  const signOut = useCallback(() => {
    clearAuth();
    latestAuth.current = null;
    setSession({ status: 'signedOut' });
    setError(null);
  }, []);

  return useMemo(
    () => ({
      session,
      error,
      apiBaseUrl: API_BASE_URL,
      refresh,
      startSignIn,
      signOut,
    }),
    [session, error, refresh, startSignIn, signOut],
  );
}
