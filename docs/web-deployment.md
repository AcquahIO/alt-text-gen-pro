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

## Release order

1. Provision or attach Heroku Postgres and confirm `DATABASE_URL` is present.
2. Deploy the `server` repository. Its release process runs `prisma migrate deploy` before the web process starts.
3. Confirm `GET /healthz` and `GET /readyz` both return HTTP 200.
4. Push the root repository to `main` and wait for the production SiteGround workflow to finish.
5. Run the public smoke test from the repository root:

   ```sh
   API_BASE_URL=https://alt-text-gen-pro-backend-4e3b4315d0d7.herokuapp.com \
   WEB_BASE_URL=https://your-production-domain.example \
   node scripts/verify-production.mjs
   ```

6. Provision the private, time-limited Chrome reviewer account in a one-off Heroku dyno. Keep the password out of source control and public listing fields:

   ```sh
   export REVIEWER_EMAIL=chrome-review@example.com
   read -s "REVIEWER_PASSWORD?Reviewer password: "
   export REVIEWER_PASSWORD
   heroku run --app alt-text-gen-pro-backend \
     --env REVIEWER_EMAIL="$REVIEWER_EMAIL",REVIEWER_PASSWORD="$REVIEWER_PASSWORD" \
     npm run reviewer:provision
   unset REVIEWER_PASSWORD
   ```

7. Test toolbar sign-in, subscription status, uploaded-image generation, copy, metadata download, and right-click generation using that account.
8. Update the existing Chrome Web Store item and add the credentials only to its private reviewer notes.

## Rollback

- Backend: use `heroku releases:rollback <last-good-release> --app alt-text-gen-pro-backend`. Prisma migrations are forward-only; do not delete production tables during rollback.
- Frontend: revert the release commit on `main` and let the production workflow redeploy the prior build.
- Chrome: do not submit a package until production smoke checks pass. If a submitted update is faulty, use the Chrome Web Store rollback option or upload the prior known-good package with a higher version.

The production Chrome listing is:

`https://chromewebstore.google.com/detail/alt-text-generator-pro/gdijbieeagfndfaokkpbcekndoldmilp`

The frontend also uses this URL as its built-in fallback if `VITE_CHROME_LINK` is missing.
