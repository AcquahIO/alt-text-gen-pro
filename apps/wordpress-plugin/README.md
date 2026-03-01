# WordPress Plugin Starter

This folder contains the first WordPress plugin scaffold for Alt Text Generator Pro.

## Plugin path

- `alt-text-generator-pro/`

## What this starter includes

- WordPress plugin bootstrap file.
- Admin settings page:
  - Backend base URL
  - OAuth-style account connect flow (browser redirect + one-time code exchange)
  - Timeout
- REST endpoint:
  - `POST /wp-json/alt-text-generator-pro/v1/generate`
- Backend forwarding to `/generate-alt-text` with `client_scope=wordpress`.

## Local packaging

From this folder:

1. `cd apps/wordpress-plugin`
2. `zip -r alt-text-generator-pro.zip alt-text-generator-pro`

Then upload the zip in WordPress admin.

## Backend redirect allowlist

For OAuth account connect to work, backend (`server`) must allow your WordPress admin origin in:

- `AUTH_ALLOWED_REDIRECT_ORIGINS`

## Next implementation steps

1. Replace admin-page-only connect with a polished block/editor UX for connecting and generating.
2. Add Gutenberg/media-library UI for one-click alt text generation.
3. Support per-site account linking + entitlement checks in central backend.
4. Add telemetry, retries, and better admin UX for error handling.
