# SiteGround + Heroku Web Deployment

This document describes the deployment model for the web frontend hosted on SiteGround with backend APIs on Heroku.

## Topology

- Frontend: SiteGround static hosting
- Backend: existing Heroku API
- CI/CD: GitHub Actions (`.github/workflows/deploy-web.yml`)

## Branch mapping

- `staging` -> staging SiteGround root (auto deploy)
- `main` -> production SiteGround root (deploy from `production` environment)

## SiteGround requirements

1. Configure separate roots for production and staging.
2. Enable password protection on staging root.
3. Ensure `public/.htaccess` is deployed so SPA routes rewrite to `index.html`.
4. Create a SiteGround FTP account for the GitHub Actions deploy. This workflow uses FTP over TLS on port `21`, not SSH-key SFTP.

## Staging indexing control

Staging builds set `VITE_STAGING=true`, which injects `noindex,nofollow` robots meta.

## Heroku environment variables

- `AUTH_ALLOWED_REDIRECT_ORIGINS`: include production + staging origins
- `CORS_ALLOWED_ORIGINS`: include production + staging origins
- `WEB_ALLOWED_RETURN_ORIGINS`: include production + staging origins

## GitHub Environment Secrets

Set the same secret keys in both `staging` and `production`, with environment-specific values:

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

## Recommended production safety

Configure required reviewer approval on the GitHub `production` environment to gate deploys from `main`.
