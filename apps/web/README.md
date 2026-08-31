# Alt Text Generator Pro Product Website

React product website for Alt Text Generator Pro. The customer-facing product is the Chrome extension; agent use is presented as a separately metered API and MCP service.

## Routes

- `/:locale/` Chrome extension landing and pricing page
- `/:locale/api` agent API and MCP product page
- `/api` and `/mcp` locale-aware entry routes
- legacy `/app/*` routes redirect to the localised landing page

## Local development

1. Copy `.env.example` to `.env` and update values.
2. Install dependencies:
   - `npm install`
3. Start dev server:
   - `npm run dev`

## Build

- `npm run build`

Vite copies `public/.htaccess` into `dist/` for SiteGround locale redirects, canonical slashes, security headers, and real 404 handling.

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
- `VITE_APP_ORIGIN`
- `VITE_AGENT_API_ORIGIN`
- `VITE_CHROME_LINK`

The production build also emits `robots.txt`, `sitemap.xml`, `llms.txt`, and `/.well-known/mcp.json`; run `npm run verify:seo` after building to validate their links and SEO cardinality.

SiteGround upload secrets in this repo are configured for an FTP account on port `21` and the workflow uses FTP over TLS via `lftp`.

The website does not contain a customer generator, account dashboard, or checkout flow. Chrome account and billing capabilities stay inside the extension.
