import crypto from 'node:crypto';

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function isValidShopDomain(shop) {
  return typeof shop === 'string' && SHOP_DOMAIN_RE.test(shop.trim());
}

export function buildAuthorizeUrl({
  shop,
  apiKey,
  scopes,
  redirectUri,
  state,
}) {
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set('client_id', apiKey);
  url.searchParams.set('scope', scopes.join(','));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

function toSortedQueryString(params) {
  const entries = Object.entries(params)
    .filter(([key, value]) => key !== 'hmac' && key !== 'signature' && typeof value !== 'undefined')
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)]);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([key, value]) => `${key}=${value}`).join('&');
}

export function verifyOAuthQueryHmac(params, apiSecret) {
  const provided = params.hmac;
  if (typeof provided !== 'string' || !provided) return false;
  const data = toSortedQueryString(params);
  const digest = crypto.createHmac('sha256', apiSecret).update(data).digest('hex');
  return timingSafeEqualHex(digest, provided);
}

export function verifyWebhookHmac(rawBodyBuffer, headerHmac, webhookSecret) {
  if (!rawBodyBuffer || !headerHmac || !webhookSecret) return false;
  const digest = crypto.createHmac('sha256', webhookSecret).update(rawBodyBuffer).digest('base64');
  return timingSafeEqualBase64(digest, headerHmac);
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

function timingSafeEqualBase64(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  try {
    const left = Buffer.from(a, 'base64');
    const right = Buffer.from(b, 'base64');
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
