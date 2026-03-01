# Shopify App Starter

This folder contains the first Shopify app scaffold for Alt Text Generator Pro.

## What this starter includes

- OAuth install start endpoint: `GET /auth/start?shop={shop}.myshopify.com`
- OAuth callback endpoint: `GET /auth/callback`
- Embedded admin page: `GET /app?shop={shop}.myshopify.com&host=...`
- OAuth-style account-link start: `POST /app/link-account/start`
- OAuth-style account-link callback: `GET /app/link-account/callback`
- Webhook endpoint for subscription updates: `POST /webhooks/shopify/app-subscriptions/update`
- Internal forwarding hooks to the central backend:
  - `POST /api/internal/shopify/install` (expected in backend)
  - `POST /api/internal/shopify/subscription-update` (expected in backend)
  - `POST /api/internal/shopify/link-account` (expected in backend)

## Run locally

1. Copy `.env.example` to `.env` and fill values.
2. In backend (`server`) env, set `AUTH_ALLOWED_REDIRECT_ORIGINS` to include this app origin (for example `http://localhost:9090`).
3. Install dependencies:
   - `npm install`
4. Start dev server:
   - `npm run dev`

Server defaults to `http://localhost:9090`.

## Current limitations

- Shop tokens are stored in memory for now (development only).
- No durable database integration yet.
- Admin page is embedded App Bridge-compatible starter shell.
- Backend internal routes are wired for install/subscription/account-link sync.

## Next implementation steps

1. Persist shop install + token in database.
2. Implement full App Bridge + Polaris embedded front-end with authenticated server session.
3. Add durable token/session storage and secure at-rest encryption.
4. Expand webhook coverage (uninstall, subscription create/update/cancel) and entitlement reconciliation.
