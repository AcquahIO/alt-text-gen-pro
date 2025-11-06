import {
  FALLBACK_PRODUCTION_BASE,
  KNOWN_PRODUCTION_ORIGINS,
  collectKnownRemoteOrigins,
  isLocalOrigin,
  isRecognizedOrigin,
  normalizeBaseUrl,
  persistAuthBase,
} from '../../../utils/env.js';

// Anticipate bundler providing import.meta.env on the extension side.
type ManifestLike = { host_permissions?: string[] } | undefined;

type KnownOriginOptions = {
  envOrigin: string | null;
  manifest: ManifestLike;
};

function buildKnownOrigins({ envOrigin, manifest }: KnownOriginOptions) {
  const additionalOrigins = envOrigin ? [envOrigin, ...KNOWN_PRODUCTION_ORIGINS] : [...KNOWN_PRODUCTION_ORIGINS];
  return collectKnownRemoteOrigins({ additionalOrigins, manifest });
}

async function checkReachable(origin: string): Promise<boolean> {
  if (!isLocalOrigin(origin)) return true;
  try {
    const res = await fetch(`${origin}/`, { method: 'GET', cache: 'no-store', credentials: 'omit' });
    return res.ok;
  } catch (err) {
    console.warn('Local origin unreachable, falling back to production', err);
    return false;
  }
}

async function adoptOrigin(origin: string | null, known: Set<string>): Promise<string | null> {
  if (!origin || !isRecognizedOrigin(origin, known)) return null;
  if (!(await checkReachable(origin))) return null;
  if (!isLocalOrigin(origin)) persistAuthBase(origin);
  return origin;
}

export async function getAppBaseUrl(): Promise<string> {
  const envOrigin = normalizeBaseUrl((import.meta as any)?.env?.VITE_APP_BASE_URL);
  const manifest = typeof chrome !== 'undefined' ? chrome.runtime?.getManifest?.() : undefined;
  const knownOrigins = buildKnownOrigins({ envOrigin, manifest });

  const envCandidate = await adoptOrigin(envOrigin, knownOrigins);
  if (envCandidate) return envCandidate;

  if (typeof chrome !== 'undefined') {
    try {
      const local = await chrome.storage.local.get(['authBaseUrl']);
      const fromLocal = await adoptOrigin(normalizeBaseUrl(local?.authBaseUrl), knownOrigins);
      if (fromLocal) return fromLocal;
    } catch (err) {
      console.warn('Reading authBaseUrl from storage failed', err);
    }

    try {
      const sync = await chrome.storage.sync.get(['apiEndpoint']);
      const fromSync = await adoptOrigin(normalizeBaseUrl(sync?.apiEndpoint), knownOrigins);
      if (fromSync) return fromSync;
    } catch (err) {
      console.warn('Reading apiEndpoint from storage failed', err);
    }

    try {
      const manifestEntry = chrome.runtime?.getManifest?.()
        ?.host_permissions?.find((entry) => entry && /^https?:/.test(entry) && !entry.includes('localhost'));
      const fromManifest = await adoptOrigin(normalizeBaseUrl(manifestEntry?.replace(/\*.*$/, '')), knownOrigins);
      if (fromManifest) return fromManifest;
    } catch (err) {
      console.warn('Unable to derive base URL from manifest', err);
    }
  }

  for (const origin of KNOWN_PRODUCTION_ORIGINS) {
    const candidate = await adoptOrigin(origin, knownOrigins);
    if (candidate) return candidate;
  }
  return 'http://localhost:8787';
}

export {
  FALLBACK_PRODUCTION_BASE,
  collectKnownRemoteOrigins,
  isLocalOrigin,
  isRecognizedOrigin,
  normalizeBaseUrl,
  persistAuthBase,
};
