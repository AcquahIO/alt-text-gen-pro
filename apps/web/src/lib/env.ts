function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export const APP_ORIGIN =
  normalizeOrigin(import.meta.env.VITE_APP_ORIGIN) ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

export const IS_STAGING = import.meta.env.VITE_STAGING === 'true';

export const AGENT_API_ORIGIN =
  normalizeOrigin(import.meta.env.VITE_AGENT_API_ORIGIN) ??
  'https://alt-text-gen-pro-backend-4e3b4315d0d7.herokuapp.com';
