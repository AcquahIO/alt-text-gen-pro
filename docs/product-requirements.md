# Alt Text Generator Pro — Confirmed Product Direction

Status: approved implementation direction

Last updated: 30 August 2026

## Product thesis

Alt Text Generator Pro has two distinct products sharing one backend:

1. a complete Chrome extension for people;
2. a separately authenticated, metered MCP/API service for agents.

The extension is the only customer-facing generation application. The website explains the products and routes people to Chrome or to the agent connection; it is not a second generator.

## Chrome product

The Chrome extension popup and full-page workspace own the complete human workflow:

- sign-in and account management;
- trial and Chrome subscription initiation;
- Stripe Checkout and Customer Portal hand-off;
- subscription management and cancellation;
- usage allowance and billing-state messaging;
- page scanning, uploads, and batch generation;
- page/product context, language, focus-keyword, and brand controls;
- editable review, copy, and metadata-preserving downloads;
- local history and settings.

Stripe may open a secure hosted tab, but the action starts inside the extension. There is one human offer: Chrome. Existing web-only and Web + Chrome plan records may remain for backwards compatibility, but must not be purchasable or marketed.

## Website

The public website contains:

- the landing page;
- Chrome product and pricing information;
- an Add to Chrome call to action;
- a dedicated API/MCP product page;
- privacy, terms, support, and technically necessary authentication or billing callback pages.

There is no customer-facing `/app` generator or web control centre. Legacy `/app` URLs redirect to the public product website.

## Agent MCP/API product

The agent product is commercially and operationally separate from the Chrome subscription:

- its own connection and entitlement;
- opaque, scoped access tokens stored only as hashes;
- explicit scopes such as `metadata:generate` and `usage:read`;
- idempotent request and usage records;
- per-token rate and concurrency controls;
- a no-charge usage summary tool;
- revocation, expiry, last-used, and audit controls.

The legacy shared `BACKEND_API_KEY` is not a public agent credential. Chrome continues to authenticate with its signed-in user token.

Initial MCP tools:

- `generate_image_metadata`;
- `usage_get_summary`.

`generate_image_metadata_batch` follows after the single-image idempotency and usage ledger is proven. Titles, captions, and long descriptions are outside the initial scope.

## Agent image inputs

The target generation contract accepts:

- a public HTTPS image URL;
- an uploaded asset ID;
- a data URL for a small image;
- optional page or product context;
- optional language, focus keyword, and brand context.

Large images use a direct upload or short-lived upload URL rather than a large MCP base64 payload. Remote fetches must reject credentials, local names, private/reserved addresses, unsafe redirects, oversized bodies, and mismatched image content.

The current local foundation enables supported typed image data URLs only. Public URL fetching, asset IDs, and direct uploads remain disabled until the bounded fetch and upload paths above are implemented and verified.

## Canonical response

The structured `alt_text` field is the canonical output. Embedded image metadata does not automatically populate a website's HTML `alt` attribute; a receiving agent or CMS must map `alt_text` into its actual alt field.

Target conceptual response when processed-file delivery is enabled:

```json
{
  "original_format": "image/jpeg",
  "output_format": "image/jpeg",
  "alt_text": "Oak dining chair with a curved wooden backrest.",
  "metadata_embedded": true,
  "processed_image_url": "short-lived signed URL"
}
```

The current agent response returns `metadata_embedded: false` and `processed_image_url: null`; the structured `alt_text` is available now, while server-side file processing remains deferred.

## Image return contract

The default output format is `original`:

- JPEG stays JPEG and receives XMP `dc:description`;
- PNG stays PNG and receives Unicode-safe `iTXt` or XMP;
- WebP stays WebP and receives an XMP chunk.

Metadata-only processing must not silently recompress, resize, or alter pixels. Preserve the filename, dimensions, pixels, and visual quality wherever possible. Unsupported formats are returned unchanged with `metadata_embedded: false` and an explicit reason. Any conversion requires an explicit future output-format option.

## Alt-text quality contract

For an image plus optional context, return one natural candidate that:

1. describes what is visibly present;
2. stays at or below 125 characters;
3. avoids “image of”, promotional claims, hashtags, and keyword stuffing;
4. uses a keyword or brand only when visibly and contextually justified;
5. remains editable before copying, downloading, or publishing.

Accuracy is more important than keyword inclusion.

## Usage and billing semantics

- Count one unit only after a successful image generation.
- Retries with the same caller and idempotency key return the recorded result and do not charge twice.
- Uploads, usage summaries, failed generations, rate-limit rejections, and idempotent replays consume zero units.
- Chrome allowance and agent usage are separate products and entitlements.
- Live Stripe catalogue or meter changes require a separate, explicit release action.

## Security and privacy

- Human generation requires a signed-in account and Chrome entitlement.
- Agent generation requires a valid, unrevoked, unexpired token with the exact scope.
- Images and supplied context are processed for the request and are not stored in generation telemetry.
- Operational telemetry may record model, token counts, estimated cost, latency, scope, outcome, and non-sensitive error category.
- Payment-card data remains with Stripe.
- Raw access tokens are shown once and are never stored or logged in plaintext.

## Acceptance criteria

- JPEG, PNG, and WebP metadata tests prove format preservation and Unicode-safe descriptions.
- Unsupported files remain byte-identical and return an explicit embedding reason.
- Chrome popup and workspace cover account, subscription, allowance, scan/upload, editing, copy, download, history, and settings.
- The web build has no customer generator route or web-only/Web + Chrome purchase path.
- Agent token, scope, expiry, revocation, idempotency, rate, concurrency, and usage-summary paths have focused tests.
- Extension UI build, server lint/tests/TypeScript build, Prisma generation, web build, and package verification pass before release.
- Local implementation, deployment, Chrome Store submission, Stripe catalogue changes, and ordinary-browser production verification are reported as distinct states.

## Deferred

- Safe public-URL fetching, uploaded asset IDs, and direct-upload flows for agents.
- Server-side metadata embedding, processed-file storage, and short-lived delivery links.
- Agent batch generation until the single-image ledger is proven.
- Automatic publishing into third-party CMS fields.
- Explicit image-format conversion.
- Titles, captions, and long descriptions.
- Shopify and WordPress distribution.
- Team seats and organisation billing.

## Release boundary

This document authorises local implementation and proportionate verification only. It does not authorise a commit, deployment, website publication, Chrome Store submission, production migration, live Stripe change, or production credential publication.
