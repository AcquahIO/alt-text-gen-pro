# Alt Text Generator Pro Product Requirements

Status: Living document (single source of truth)  
Owner: Product + Engineering  
Last updated: 2026-02-08

## 1) Product Goal

Build Alt Text Generator Pro as a multi-platform product with:
- One shared user identity across Chrome, Shopify, and WordPress.
- Flexible subscriptions:
  - Platform-specific plans (`chrome`, `shopify`, `wordpress`)
  - Bundle plan (`all-access`) that unlocks all platforms.
- Consistent alt-text generation quality and account state across all clients.

## 2) Platforms In Scope

- Chrome Extension (Manifest V3)
- Shopify App
- WordPress Plugin
- Shared Backend API (`server/`) and shared account/billing domain

## 3) Core Product Requirements

### 3.1 Unified Account Identity

- A user creates one Alt Text Generator Pro account (email/password and/or Google sign-in).
- The same account can sign in to all clients (Chrome, Shopify, WordPress).
- Account profile and billing state are centralized in backend.

### 3.2 Entitlement-Based Access

- Access is controlled by entitlements, not by client app alone.
- Entitlement codes:
  - `chrome`
  - `shopify`
  - `wordpress`
  - `all` (implies all above)
- Access rule:
  - User may use a client if they have matching entitlement OR `all`.

### 3.3 Subscription Catalog

- Product plans:
  - `plan_chrome`
  - `plan_shopify`
  - `plan_wordpress`
  - `plan_all_access`
- Trials:
  - Trial policy is tracked in Decision Register item `DR-001`.
- Billing portal support for managing active subscription(s).

### 3.4 Cross-Platform Consistency

- Subscription and entitlement status must resolve consistently across all clients.
- Upgrade/downgrade/cancellation should propagate to all clients quickly (target < 60s after webhook processing).
- Shared usage limits policy must be defined:
  - Option A: Shared quota by account
  - Option B: Per-platform quota
  - Option C: Hybrid (decision pending)

## 4) Platform-Specific Requirements

### 4.1 Chrome Extension

- Keep MV3-compliant extension architecture.
- Must support sign-in, plan display, upgrade/manage flow.
- Must block generation if entitlement check fails.

### 4.2 Shopify App

- Shopify app uses same Alt Text Generator Pro identity mapping.
- Billing model must comply with Shopify billing requirements for app distribution channel used.
- Store-level install must be linkable to a central account identity.

### 4.3 WordPress Plugin

- Plugin authenticates to central backend using shared account.
- Plugin must clearly disclose external SaaS usage/privacy behavior.
- Plugin enforces entitlement before generation.

## 5) Backend Requirements

### 5.1 Data Model (Target)

Current model stores one subscription on `User`; target model needs normalized billing/entitlements.

Required entities:
- `User` (identity)
- `Subscription` (provider record; one user can have many)
- `Entitlement` (resolved access grants by product scope)
- `BillingProviderCustomer` mapping (for Stripe and/or platform providers)
- `UsageCounter` (may become per-scope)

Minimum fields (guidance):
- `Subscription`: `id`, `userId`, `provider`, `providerSubscriptionId`, `status`, `planCode`, `currentPeriodEnd`, `trialEnd`, `cancelAtPeriodEnd`
- `Entitlement`: `id`, `userId`, `scope`, `sourceSubscriptionId`, `status`, `startsAt`, `endsAt`

### 5.2 API Contracts (Target)

- `GET /api/subscription-status`
  - Returns user subscription summary and per-scope entitlements.
- `POST /api/create-checkout-session`
  - Accepts selected `planCode`.
- `POST /api/create-portal-session`
  - Opens relevant billing management flow.
- Protected generation routes must require entitlement for requested scope.

### 5.3 Webhooks

- Webhook processing must update:
  - Subscription records
  - Derived entitlements
  - Trial markers
- Webhook handlers must be idempotent and safe to replay.

## 6) UX Requirements

- Signed-in state must show:
  - Current plan(s)
  - Which platforms are unlocked
  - Trial state and renewal/cancelation metadata
- Upgrade path:
  - User can buy single platform plan or all-access plan.
- Clear messaging when access denied:
  - Explain missing entitlement and provide upgrade CTA.

## 7) Security & Compliance

- JWT-based auth for API access; secure token storage per platform.
- Strict allowlist/validation for redirect URIs and origins.
- Principle of least privilege for API keys and webhooks.
- Privacy policy and terms must cover all three platform clients.

## 8) Reliability & Quality

- Entitlement checks must be deterministic and test-covered.
- Billing state should recover from webhook delays/retries.
- Core flows require automated tests:
  - Sign-in
  - Checkout by plan
  - Webhook sync
  - Entitlement enforcement
  - Upgrade/downgrade path

## 9) Milestones

### Phase 1: Foundation (Backend Domain)

- Introduce normalized subscription + entitlement schema.
- Add migration from single-subscription user model.
- Ship new status API shape with per-scope entitlements.

### Phase 2: Chrome Migration

- Update extension UI/session to consume entitlement map.
- Update checkout to select plan.
- Keep current behavior for existing paid users via migration logic.

### Phase 3: WordPress Plugin

- Build plugin auth flow to shared backend.
- Enforce entitlements and usage policies.
- Add plugin docs/privacy disclosures.

### Phase 4: Shopify App

- Build Shopify app auth/account linking.
- Implement compliant Shopify billing strategy.
- Map Shopify billing outcomes to shared entitlements.

### Phase 5: Hardening

- Observability, reconciliation jobs, billing/entitlement audit reports.
- End-to-end tests across all clients.

## 10) Success Metrics

- % of active users with successful cross-platform sign-in
- Entitlement mismatch rate (target: near zero)
- Subscription conversion by plan type (single-platform vs all-access)
- Churn by plan type
- Support ticket volume for billing/access issues

## 11) Decision Register (Execution Start)

This table tracks required product decisions.  
Status values: `proposed`, `approved`, `blocked`.

| ID | Decision | Recommended default to start | Owner | Target date | Status |
| --- | --- | --- | --- | --- | --- |
| DR-001 | Trial scope | One 3-day free trial per account (not per platform). | Product Owner | 2026-02-12 | proposed |
| DR-002 | Usage limits policy | Shared account-level quota across all platforms for v1. | Product + Engineering | 2026-02-12 | proposed |
| DR-003 | Stripe plan mapping | Create four recurring monthly prices: `plan_chrome`, `plan_shopify`, `plan_wordpress`, `plan_all_access` (USD-first). | Engineering | 2026-02-13 | proposed |
| DR-004 | Shopify launch path | Start with custom app pilot stores, then evaluate public listing after stability/compliance pass. | Product | 2026-02-14 | proposed |
| DR-005 | WordPress launch path | Start private/commercial plugin distribution first; defer wordpress.org listing until policy review is complete. | Product | 2026-02-14 | proposed |
| DR-006 | Entitlement source of truth | Backend database derived from subscription events, with webhook idempotency and periodic reconciliation. | Engineering | 2026-02-13 | proposed |
| DR-007 | Existing user migration | Migrate current active/trial users to temporary `all` entitlement during migration window. | Engineering | 2026-02-15 | proposed |

## 12) Immediate Next Actions (Kickoff)

1. Approve or edit `DR-001` through `DR-007`.
2. Finalize Stripe price IDs and map each to entitlement scopes.
3. Implement Prisma schema migration for `Subscription` and `Entitlement`.
4. Update `/api/subscription-status` to return entitlement map.
5. Update checkout API to require `planCode`.
6. Update Chrome UI to read entitlement map and route to plan-specific checkout.

## 13) Change Log

- 2026-02-08: Initial cross-platform requirements draft created as central project PRD.
- 2026-02-08: Added execution decision register (`DR-001` to `DR-007`) and kickoff actions.
