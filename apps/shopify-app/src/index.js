import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import morgan from 'morgan';
import { env } from './env.js';
import { buildAuthorizeUrl, isValidShopDomain, verifyOAuthQueryHmac, verifyWebhookHmac } from './shopify.js';
import { getShopToken, linkShopAccount, listShops, upsertShopToken } from './tokenStore.js';

const app = express();
const stateStore = new Map();
const accountLinkStateStore = new Map();
const STATE_TTL_MS = 5 * 60 * 1000;

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false }));

setInterval(() => clearExpiredStateEntries(), 60_000).unref();

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'alt-text-generator-pro-shopify-app',
    installedShops: listShops().length,
  });
});

app.get('/app', (req, res) => {
  const shop = typeof req.query.shop === 'string' ? req.query.shop.trim().toLowerCase() : '';
  if (!isValidShopDomain(shop)) {
    return res.status(400).send('Missing or invalid shop query parameter.');
  }

  const notice = typeof req.query.notice === 'string' ? req.query.notice : '';
  const message = typeof req.query.message === 'string' ? req.query.message : '';
  const host = typeof req.query.host === 'string' ? req.query.host : '';
  const installation = getShopToken(shop);

  res.type('html').send(
    renderAdminHtml({
      shop,
      installation,
      notice,
      message,
      host,
      apiKey: env.SHOPIFY_API_KEY,
    })
  );
});

app.get('/auth/start', (req, res) => {
  const shop = typeof req.query.shop === 'string' ? req.query.shop.trim().toLowerCase() : '';
  if (!isValidShopDomain(shop)) {
    return res.status(400).json({ error: 'Invalid or missing "shop" query parameter.' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  stateStore.set(state, { shop, expiresAt: Date.now() + STATE_TTL_MS });

  const authorizeUrl = buildAuthorizeUrl({
    shop,
    apiKey: env.SHOPIFY_API_KEY,
    scopes: env.SHOPIFY_SCOPES,
    redirectUri: `${env.APP_URL}/auth/callback`,
    state,
  });

  res.redirect(authorizeUrl);
});

app.get('/auth/callback', async (req, res) => {
  const params = req.query;
  const shop = typeof params.shop === 'string' ? params.shop.trim().toLowerCase() : '';
  const code = typeof params.code === 'string' ? params.code.trim() : '';
  const state = typeof params.state === 'string' ? params.state.trim() : '';

  if (!isValidShopDomain(shop) || !code || !state) {
    return res.status(400).send('Missing or invalid callback parameters.');
  }

  if (!verifyOAuthQueryHmac(params, env.SHOPIFY_API_SECRET)) {
    return res.status(401).send('Invalid callback signature.');
  }

  const stateRecord = stateStore.get(state);
  stateStore.delete(state);
  if (!stateRecord || stateRecord.shop !== shop || stateRecord.expiresAt < Date.now()) {
    return res.status(401).send('Expired or invalid state.');
  }

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.SHOPIFY_API_KEY,
        client_secret: env.SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      return res.status(400).send(`Unable to exchange access token: ${body}`);
    }

    const tokenPayload = await tokenRes.json();
    const accessToken = tokenPayload?.access_token;
    if (typeof accessToken !== 'string' || !accessToken) {
      return res.status(400).send('Missing access token from Shopify.');
    }

    upsertShopToken(shop, accessToken);

    await notifyBackendInstall({
      shop,
      accessToken,
    });

    res.type('html').send(renderInstallSuccessHtml(shop));
  } catch (err) {
    console.error('OAuth callback failed', err);
    res.status(500).send('Shop install failed.');
  }
});

app.post('/app/link-account/start', async (req, res) => {
  const shop = typeof req.body.shop === 'string' ? req.body.shop.trim().toLowerCase() : '';
  const host = typeof req.body.host === 'string' ? req.body.host.trim() : '';
  if (!isValidShopDomain(shop)) return res.status(400).send('Invalid shop domain.');
  const installation = getShopToken(shop);
  if (!installation) {
    return redirectWithNotice(res, { shop, host, notice: 'error', message: 'Shop is not installed yet. Complete OAuth install first.' });
  }
  if (!env.BACKEND_API_BASE_URL) {
    return redirectWithNotice(res, { shop, host, notice: 'error', message: 'BACKEND_API_BASE_URL is not configured.' });
  }

  const state = crypto.randomBytes(24).toString('hex');
  accountLinkStateStore.set(state, { shop, host, expiresAt: Date.now() + STATE_TTL_MS });

  const callbackUrl = new URL('/app/link-account/callback', env.APP_URL);
  callbackUrl.searchParams.set('shop', shop);
  if (host) callbackUrl.searchParams.set('host', host);

  const connectUrl = new URL('/auth/start', env.BACKEND_API_BASE_URL);
  connectUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  connectUrl.searchParams.set('state', state);
  connectUrl.searchParams.set('client', 'shopify');

  return res.redirect(connectUrl.toString());
});

app.get('/app/link-account/callback', async (req, res) => {
  const shop = typeof req.query.shop === 'string' ? req.query.shop.trim().toLowerCase() : '';
  const host = typeof req.query.host === 'string' ? req.query.host.trim() : '';
  const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
  const state = typeof req.query.state === 'string' ? req.query.state.trim() : '';

  if (!isValidShopDomain(shop)) return res.status(400).send('Invalid shop domain.');
  if (!code || !state) {
    return redirectWithNotice(res, { shop, host, notice: 'error', message: 'Missing account-link callback parameters.' });
  }

  const stateRecord = accountLinkStateStore.get(state);
  accountLinkStateStore.delete(state);
  if (!stateRecord || stateRecord.shop !== shop || stateRecord.expiresAt < Date.now()) {
    return redirectWithNotice(res, { shop, host, notice: 'error', message: 'Invalid or expired account-link state.' });
  }

  if (!env.BACKEND_API_BASE_URL) {
    return redirectWithNotice(res, { shop, host, notice: 'error', message: 'BACKEND_API_BASE_URL is not configured.' });
  }

  try {
    const authRes = await fetch(`${env.BACKEND_API_BASE_URL}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const authPayload = await authRes.json().catch(() => ({}));
    if (!authRes.ok) {
      const reason = authPayload?.error || authPayload?.message || 'Unable to complete account link.';
      return redirectWithNotice(res, { shop, host, notice: 'error', message: reason });
    }

    const linkedToken = typeof authPayload?.accessToken === 'string' ? authPayload.accessToken : '';
    const linkedEmail = typeof authPayload?.user?.email === 'string' ? authPayload.user.email : '';
    const linkedUserId = typeof authPayload?.user?.id === 'string' ? authPayload.user.id : '';
    if (!linkedToken || !linkedUserId) {
      return redirectWithNotice(res, { shop, host, notice: 'error', message: 'Account-link response missing required fields.' });
    }

    linkShopAccount(shop, { email: linkedEmail, accessToken: linkedToken });
    await notifyBackendLinkAccount({ shop, userId: linkedUserId, email: linkedEmail });
    return redirectWithNotice(res, { shop, host, notice: 'success', message: `Linked ${linkedEmail} to ${shop}.` });
  } catch (err) {
    console.error('Account link callback failed', err);
    return redirectWithNotice(res, { shop, host, notice: 'error', message: 'Linking failed due to a network or server error.' });
  }
});

app.post('/webhooks/shopify/app-subscriptions/update', express.raw({ type: 'application/json' }), async (req, res) => {
  const headerHmac = typeof req.headers['x-shopify-hmac-sha256'] === 'string' ? req.headers['x-shopify-hmac-sha256'] : '';
  const topic = typeof req.headers['x-shopify-topic'] === 'string' ? req.headers['x-shopify-topic'] : '';
  const shop = typeof req.headers['x-shopify-shop-domain'] === 'string' ? req.headers['x-shopify-shop-domain'] : '';

  if (!verifyWebhookHmac(req.body, headerHmac, env.SHOPIFY_WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid webhook signature.');
  }

  try {
    const payload = JSON.parse(req.body.toString('utf8'));
    await notifyBackendSubscriptionUpdate({ shop, topic, payload });
    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook processing failed', err);
    res.status(500).json({ error: 'webhook_failed' });
  }
});

app.use(express.json({ limit: '2mb' }));

app.get('/api/shops', (_req, res) => {
  res.json({ shops: listShops() });
});

app.listen(env.PORT, () => {
  console.log(`Shopify app listening on http://localhost:${env.PORT}`);
});

function clearExpiredStateEntries() {
  const now = Date.now();
  for (const [state, record] of stateStore.entries()) {
    if (record.expiresAt <= now) stateStore.delete(state);
  }
  for (const [state, record] of accountLinkStateStore.entries()) {
    if (record.expiresAt <= now) accountLinkStateStore.delete(state);
  }
}

async function notifyBackendInstall({ shop, accessToken }) {
  if (!env.BACKEND_API_BASE_URL || !env.BACKEND_INTERNAL_API_KEY) {
    return;
  }
  await fetch(`${env.BACKEND_API_BASE_URL}/api/internal/shopify/install`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.BACKEND_INTERNAL_API_KEY,
    },
    body: JSON.stringify({
      shop,
      accessToken,
    }),
  }).catch((err) => {
    console.warn('Unable to notify backend install event', err);
  });
}

async function notifyBackendSubscriptionUpdate({ shop, topic, payload }) {
  if (!env.BACKEND_API_BASE_URL || !env.BACKEND_INTERNAL_API_KEY) {
    return;
  }
  await fetch(`${env.BACKEND_API_BASE_URL}/api/internal/shopify/subscription-update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.BACKEND_INTERNAL_API_KEY,
    },
    body: JSON.stringify({
      shop,
      topic,
      payload,
    }),
  }).catch((err) => {
    console.warn('Unable to notify backend subscription event', err);
  });
}

async function notifyBackendLinkAccount({ shop, userId, email }) {
  if (!env.BACKEND_API_BASE_URL || !env.BACKEND_INTERNAL_API_KEY) {
    return;
  }
  await fetch(`${env.BACKEND_API_BASE_URL}/api/internal/shopify/link-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.BACKEND_INTERNAL_API_KEY,
    },
    body: JSON.stringify({
      shop,
      userId,
      email,
    }),
  }).catch((err) => {
    console.warn('Unable to notify backend account-link event', err);
  });
}

function renderInstallSuccessHtml(shop) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Alt Text Generator Pro Installed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; padding: 2rem; }
    .card { max-width: 560px; margin: 2rem auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem 1.5rem; }
    h1 { margin: 0 0 0.5rem; font-size: 1.4rem; }
    p { margin: 0.25rem 0; line-height: 1.45; }
    code { background: #e2e8f0; border-radius: 4px; padding: 0.1rem 0.3rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Install complete</h1>
    <p>Shop connected: <code>${escapeHtml(shop)}</code></p>
    <p>Next step: implement account linking so this shop maps to a central Alt Text Generator Pro user account and entitlements.</p>
  </div>
</body>
</html>`;
}

function renderAdminHtml({ shop, installation, notice, message, host, apiKey }) {
  const hasInstallToken = Boolean(installation?.accessToken);
  const linkedEmail = installation?.linkedAccountEmail || '';
  const linkState = linkedEmail ? `Linked account: ${linkedEmail}` : 'No account linked yet';
  const noticeClass = notice === 'success' ? 'notice-success' : notice === 'error' ? 'notice-error' : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Alt Text Generator Pro Admin</title>
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; margin: 0; }
    .wrap { max-width: 780px; margin: 2rem auto; padding: 0 1rem; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem 1.1rem; margin-bottom: 1rem; }
    h1 { margin: 0 0 0.6rem; font-size: 1.35rem; }
    p { margin: 0.4rem 0; line-height: 1.45; }
    label { display: block; margin: 0.6rem 0 0.25rem; font-weight: 600; }
    input { width: 100%; max-width: 420px; padding: 0.55rem 0.65rem; border: 1px solid #cbd5e1; border-radius: 8px; }
    button { margin-top: 0.9rem; background: #0f172a; color: #fff; border: 0; border-radius: 8px; padding: 0.6rem 0.85rem; cursor: pointer; }
    .muted { color: #475569; }
    .notice { border-radius: 10px; padding: 0.7rem 0.85rem; margin-bottom: 1rem; }
    .notice-success { background: #dcfce7; border: 1px solid #86efac; color: #14532d; }
    .notice-error { background: #fee2e2; border: 1px solid #fca5a5; color: #7f1d1d; }
    code { background: #e2e8f0; border-radius: 5px; padding: 0.1rem 0.28rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Alt Text Generator Pro</h1>
      <p><strong>Shop:</strong> <code>${escapeHtml(shop)}</code></p>
      <p><strong>Install token:</strong> ${hasInstallToken ? 'Present' : 'Missing'}</p>
      <p><strong>Account state:</strong> ${escapeHtml(linkState)}</p>
    </div>

    ${
      noticeClass && message
        ? `<div class="notice ${noticeClass}">${escapeHtml(message)}</div>`
        : ''
    }

    <div class="card">
      <h2 style="margin: 0 0 0.5rem; font-size: 1.1rem;">Link your Alt Text Generator Pro account</h2>
      <p class="muted">Use secure account connect flow. You will sign in on Alt Text Generator Pro and return automatically.</p>
      <form method="post" action="/app/link-account/start">
        <input type="hidden" name="shop" value="${escapeHtml(shop)}" />
        <input type="hidden" name="host" value="${escapeHtml(host || '')}" />
        <button type="submit">Connect account</button>
      </form>
    </div>
  </div>
  <script>
    (function bootstrapEmbedded() {
      const host = ${JSON.stringify(host || '')};
      const apiKey = ${JSON.stringify(apiKey || '')};
      if (!host || !apiKey) return;

      try {
        // App Bridge v3/v4 compatibility shim using CDN global.
        const bridge = window['app-bridge'];
        if (bridge && typeof bridge.default === 'function') {
          const app = bridge.default({ apiKey, host, forceRedirect: true });
          const actions = bridge.actions || {};
          if (actions.TitleBar && typeof actions.TitleBar.create === 'function') {
            actions.TitleBar.create(app, { title: 'Alt Text Generator Pro' });
          }
          return;
        }
        if (window.shopify && typeof window.shopify.createApp === 'function') {
          const app = window.shopify.createApp({ apiKey, host, forceRedirect: true });
          if (window.shopify.actions && window.shopify.actions.TitleBar) {
            window.shopify.actions.TitleBar.create(app, { title: 'Alt Text Generator Pro' });
          }
        }
      } catch (err) {
        console.warn('App Bridge bootstrap failed', err);
      }
    })();
  </script>
</body>
</html>`;
}

function redirectWithNotice(res, { shop, host, notice, message }) {
  const url = new URL('/app', env.APP_URL);
  url.searchParams.set('shop', shop);
  if (host) url.searchParams.set('host', host);
  url.searchParams.set('notice', notice);
  url.searchParams.set('message', message);
  res.redirect(url.pathname + url.search);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
