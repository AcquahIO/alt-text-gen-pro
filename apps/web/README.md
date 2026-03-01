# Alt Text Generator Pro Web

React web app for Alt Text Generator Pro.

## Routes

- `/` landing page
- `/app` authenticated generator app
- `/app/auth/callback` auth return route
- `/app/billing/success` billing success return route
- `/app/billing/cancel` billing cancel return route

## Local development

1. Copy `.env.example` to `.env` and update values.
2. Install dependencies:
   - `npm install`
3. Start dev server:
   - `npm run dev`

## Build

- `npm run build`

Vite copies `public/.htaccess` into `dist/` for SiteGround SPA rewrites.

## Deployment model

- `staging` branch deploys to staging environment via GitHub Actions.
- `main` branch deploys to production (GitHub environment approval recommended).

## Required GitHub Environment Secrets

Each environment (`staging`, `production`) should define:

- `SG_HOST`
- `SG_PORT`
- `SG_USER`
- `SG_PASSWORD`
- `SG_REMOTE_PATH`
- `VITE_API_BASE_URL`
- `VITE_APP_ORIGIN`
- `VITE_CHROME_LINK`
- `VITE_SHOPIFY_LINK`
- `VITE_WORDPRESS_LINK`

SiteGround upload secrets in this repo are configured for an FTP account on port `21` and the workflow uses FTP over TLS via `lftp`.

## Backend requirements (Heroku)

Set backend env vars to allow web domain callbacks and CORS:

- `AUTH_ALLOWED_REDIRECT_ORIGINS`
- `CORS_ALLOWED_ORIGINS`
- `WEB_ALLOWED_RETURN_ORIGINS`
