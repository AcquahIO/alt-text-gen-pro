const KNOWN_PRODUCTION_ORIGINS = ['https://alt-text-gen-pro-backend.herokuapp.com'];
const FALLBACK_PRODUCTION_BASE = KNOWN_PRODUCTION_ORIGINS[0];

export function normalizeBaseUrl(url) {
  if (!url) return null;
  try {
    const normalized = String(url).replace(/\/+$/, '');
    const parsed = new URL(normalized);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (err) {
    console.warn('Invalid base URL encountered', url, err);
    return null;
  }
}

export function isLocalOrigin(origin) {
  return Boolean(origin && origin.startsWith('http://localhost'));
}

export function collectKnownRemoteOrigins(options = {}) {
  const { additionalOrigins = [], manifest } = options;
  const origins = new Set();

  additionalOrigins
    .map((value) => normalizeBaseUrl(value))
    .filter((value) => value && !isLocalOrigin(value))
    .forEach((value) => origins.add(value));

  try {
    const hostPermissions = manifest?.host_permissions ?? [];
    hostPermissions.forEach((entry) => {
      if (!entry || entry.includes('localhost')) return;
      const candidate = normalizeBaseUrl(entry.replace(/\*.*$/, ''));
      if (candidate) origins.add(candidate);
    });
  } catch (err) {
    console.warn('Unable to inspect manifest host permissions', err);
  }

  KNOWN_PRODUCTION_ORIGINS.filter((origin) => !isLocalOrigin(origin)).forEach((origin) => origins.add(origin));

  return origins;
}

export function isRecognizedOrigin(origin, knownRemotes) {
  if (!origin) return false;
  if (isLocalOrigin(origin)) return true;
  return knownRemotes.has(origin);
}

export function persistAuthBase(origin) {
  if (typeof chrome === 'undefined' || !origin || isLocalOrigin(origin)) return;
  try {
    chrome.storage?.local?.set?.({ authBaseUrl: origin });
  } catch (err) {
    console.warn('Unable to persist auth base URL', origin, err);
  }
}

export { FALLBACK_PRODUCTION_BASE, KNOWN_PRODUCTION_ORIGINS };
