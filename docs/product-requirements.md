# Alt Text Generator Pro — Launch Product Requirements

Status: launch scope approved
Last updated: 14 August 2026

## Product thesis

Alt Text Generator Pro helps ecommerce teams, content publishers, and SEO practitioners turn webpage or uploaded images into concise, editable alt text. The product should use a focus keyword only when the visible image and page context support it. Accuracy takes precedence over keyword inclusion.

The launch wedge is Chrome: generate while editing or reviewing a real page. The web app is the companion workflow for uploads, public image URLs, account management, and billing. Shopify and WordPress are explicitly deferred until repeat usage validates the core workflow.

## Launch surface

- Chrome extension (Manifest V3): right-click generation, page image collection, uploads, batch generation, copy, and metadata download.
- Web app: uploads, public image URLs, SEO context, editable results, billing, usage, and history.
- Shared backend: authentication, entitlements, Stripe billing, fair-use counters, generation, and privacy-minimal cost telemetry.
- Public website: SEO-oriented positioning, exact launch pricing, privacy policy, terms, and support contact.

## Core user job

Given an image and optional product/page context, return one natural alt attribute candidate that:

1. describes what is visibly present;
2. stays at or below 125 characters;
3. avoids “image of”, marketing claims, hashtags, and keyword stuffing;
4. uses the focus keyword only when visually and contextually justified;
5. remains editable before copying, downloading, or publishing.

## Launch plans

| Plan | Price | Access |
| --- | ---: | --- |
| Web | $10/month | Web generation |
| Chrome | $10/month | Chrome generation |
| Web + Chrome | $19/month | Both launch clients |

- One three-day free trial per eligible account.
- 60 successful generations/hour, 200/day, and 5,000/month, shared across entitled products.
- Failed requests do not consume the generation allowance.
- Stripe Checkout and Customer Portal are the billing surfaces.

## Quality and cost requirements

- The server controls the model and image-detail setting; clients cannot select a more expensive model.
- Launch default: `gpt-4o` with image `detail: low`.
- Record input/output tokens, estimated model cost, latency, scope, success, and error category.
- Do not store image data, page context, or generated alt text in generation telemetry.
- Remote image inputs must reject credentials, local hosts, and private network literals.
- A generation is counted only after a successful model response.

## Security and privacy requirements

- Generation requires a signed-in account and the matching entitlement.
- Email self-registration remains disabled until verified-email or password-reset flows exist; Google sign-in and pre-provisioned review accounts are supported.
- Redirect URIs and CORS origins are allowlisted.
- Images and context are processed for the request and are not intentionally persisted by the application.
- Payment-card data is handled by Stripe.
- Public privacy and terms pages must be live before Chrome Store submission.

## Launch acceptance criteria

- Backend lint, unit tests, TypeScript build, Prisma generation, and production migration pass.
- Web and extension production builds pass with no browser console errors in tested core pages.
- Chrome package contains only required MV3 source, UI bundles, icons, and locale files.
- Store screenshot is 1280×800; promotional assets are 440×280 and 1400×560.
- Chrome listing copy, single-purpose statement, permissions, and data-use disclosures match actual behaviour.
- Production `/privacy`, `/terms`, auth, subscription status, and generation endpoints are reachable.
- A reviewer account can exercise Chrome generation without entering payment details.

## First 30-day learning plan

With no existing usage baseline, success is evidence of repeated completion rather than top-of-funnel volume:

- Activation: installs that sign in and complete a first successful generation.
- Time to first value: median time from install to first copied result.
- Repeat use: accounts with successful generations on two or more distinct days within 14 days.
- Output utility: share of generated results copied or downloaded; regeneration rate as a quality warning signal.
- Reliability: successful generation rate and p95 latency.
- Unit economics: estimated OpenAI cost per successful generation and gross model margin by plan.
- Conversion: trial start, trial completion, paid conversion, and early cancellation.

## Deferred

- Shopify and WordPress distribution.
- Automatic publishing into third-party CMS fields.
- Team seats and organisation billing.
- Unverified email registration.
- Claims of ranking improvement or guaranteed accessibility compliance.

## Decisions

| Decision | Launch choice |
| --- | --- |
| Primary segment | Ecommerce/content teams doing image SEO in Chrome |
| Distribution focus | Chrome Web Store first; web app supports activation and billing |
| Output positioning | SEO-aware and accuracy-first |
| Model strategy | `gpt-4o`, `detail: low`, server-controlled |
| Quota | Shared account-level successful-generation limits |
| Scope | Web + Chrome only |
