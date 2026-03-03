import { PlanChangePreview, PlanCode, QueueItem, SubscriptionStatus } from '@/lib/types';

type BillingClient = 'extension' | 'web';

interface CheckoutPayload {
  planCode: PlanCode;
  client?: BillingClient;
  returnOrigin?: string;
  skipTrial?: boolean;
}

interface PortalPayload {
  client?: BillingClient;
  returnOrigin?: string;
}

interface PlanChangePayload {
  planCode: PlanCode;
}

interface UrlResponse {
  url: string;
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

function extractMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const maybeError = (payload as { error?: unknown }).error;
    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
    if (typeof maybeError === 'string' && maybeError.trim()) return maybeError;
  }
  return fallback;
}

async function requestWithAuth<T>(apiBaseUrl: string, token: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    const payload = await parseJsonSafe(res);
    throw new Error(extractMessage(payload, `Request failed (${res.status})`));
  }

  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export async function fetchSubscriptionStatus(apiBaseUrl: string, token: string): Promise<SubscriptionStatus> {
  return requestWithAuth<SubscriptionStatus>(apiBaseUrl, token, '/api/subscription-status', { method: 'GET' });
}

export async function createCheckoutSession(apiBaseUrl: string, token: string, payload: CheckoutPayload): Promise<string> {
  const response = await requestWithAuth<UrlResponse>(apiBaseUrl, token, '/api/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.url;
}

export async function createPortalSession(apiBaseUrl: string, token: string, payload: PortalPayload): Promise<string> {
  const response = await requestWithAuth<UrlResponse>(apiBaseUrl, token, '/api/create-portal-session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.url;
}

export async function previewPlanChange(apiBaseUrl: string, token: string, payload: PlanChangePayload): Promise<PlanChangePreview> {
  return requestWithAuth<PlanChangePreview>(apiBaseUrl, token, '/api/plan-change-preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function changePlan(apiBaseUrl: string, token: string, payload: PlanChangePayload): Promise<SubscriptionStatus> {
  return requestWithAuth<SubscriptionStatus>(apiBaseUrl, token, '/api/plan-change', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateAltText(
  apiBaseUrl: string,
  token: string,
  item: QueueItem,
  options: { language: string; context: string },
): Promise<string> {
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Client-Scope', 'web');

  const payload: Record<string, unknown> = {
    model: 'gpt-4o',
    language: options.language,
    context: {
      client_scope: 'web',
      page_context: options.context,
      image_notes: options.context,
    },
  };

  if (item.dataUrl) {
    payload.image_base64 = item.dataUrl.replace(/^data:[^,]+,/, '');
  } else if (item.imageUrl) {
    payload.image_url = item.imageUrl;
  } else {
    throw new Error('Image payload is missing.');
  }

  const res = await fetch(`${apiBaseUrl}/generate-alt-text`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const responseBody = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(extractMessage(responseBody, `Generation failed (${res.status})`));
  }

  const altText = (responseBody as { alt_text?: string } | null)?.alt_text ?? '';
  if (!altText.trim()) {
    throw new Error('Generation returned empty alt text.');
  }

  return altText.trim();
}
