const DEFAULT_API_BASE = 'https://alt-text-gen-pro-backend-4e3b4315d0d7.herokuapp.com';

function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL) ?? DEFAULT_API_BASE;

export const APP_ORIGIN =
  normalizeOrigin(import.meta.env.VITE_APP_ORIGIN) ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

export const IS_STAGING = import.meta.env.VITE_STAGING === 'true';

export function isExpired(expiresAt: number): boolean {
  return Date.now() + 30_000 >= expiresAt;
}
