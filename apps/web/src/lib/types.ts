export type Plan = 'free' | 'trial' | 'paid';
export type ClientScope = 'web' | 'chrome' | 'shopify' | 'wordpress';
export type PlanCode =
  | 'plan_web'
  | 'plan_chrome'
  | 'plan_shopify'
  | 'plan_wordpress'
  | 'plan_all_access';

export interface EntitlementMatrix {
  all: boolean;
  web: boolean;
  chrome: boolean;
  shopify: boolean;
  wordpress: boolean;
}

export interface BillingCatalogEntry {
  planCode: PlanCode;
  title: string;
  scope: ClientScope | 'all';
  unlockedScopes: Array<ClientScope | 'all'>;
  purchaseEnabled: boolean;
  current: boolean;
}

export interface UsageSnapshot {
  hour: number;
  day: number;
  month: number;
}

export interface UsageLimits {
  hour: number;
  day: number;
  month: number;
}

export interface SubscriptionStatus {
  plan: Plan;
  activePlanCode?: PlanCode | null;
  currentSubscriptionStatus?: string | null;
  trialEndsAt?: string | null;
  renewsAt?: string | null;
  providerPortalUrl?: string | null;
  hasStripeCustomer?: boolean;
  trialEligible?: boolean;
  entitlements?: Partial<EntitlementMatrix>;
  limits?: UsageLimits;
  usage?: UsageSnapshot;
  catalog?: BillingCatalogEntry[];
  displayName?: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface AuthState {
  token: string;
  expiresAt: number;
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface SessionState {
  status: 'loading' | 'signedOut' | 'signedIn';
  auth?: AuthState;
  sub?: SubscriptionStatus;
}

export type ItemStatus = 'ready' | 'generating' | 'done' | 'error';

export interface QueueItem {
  id: string;
  source: 'upload' | 'url';
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  imageUrl?: string;
  status: ItemStatus;
  altText: string;
  error?: string;
}

export interface RecentItem {
  id: string;
  previewSrc: string;
  altText: string;
  when: number;
}
