const tokensByShop = new Map();

export function upsertShopToken(shop, accessToken) {
  const existing = tokensByShop.get(shop) ?? {};
  tokensByShop.set(shop, { ...existing, accessToken, updatedAt: Date.now() });
}

export function getShopToken(shop) {
  return tokensByShop.get(shop) ?? null;
}

export function linkShopAccount(shop, account) {
  const existing = tokensByShop.get(shop);
  if (!existing) return false;
  tokensByShop.set(shop, {
    ...existing,
    linkedAccountEmail: account.email,
    linkedAccountToken: account.accessToken,
    linkedAt: Date.now(),
    updatedAt: Date.now(),
  });
  return true;
}

export function listShops() {
  return Array.from(tokensByShop.keys());
}
