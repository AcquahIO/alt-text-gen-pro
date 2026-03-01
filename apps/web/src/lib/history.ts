import { RecentItem } from '@/lib/types';

function storageKey(userId: string): string {
  return `atgp_recent_${userId}`;
}

export function readRecentItems(userId: string): RecentItem[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeRecentItems(userId: string, items: RecentItem[]): void {
  if (!userId) return;
  localStorage.setItem(storageKey(userId), JSON.stringify(items.slice(0, 20)));
}

export function addRecentItem(userId: string, item: Omit<RecentItem, 'id' | 'when'>): RecentItem[] {
  const current = readRecentItems(userId);
  const next: RecentItem = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    previewSrc: item.previewSrc,
    altText: item.altText,
    when: Date.now(),
  };
  const merged = [next, ...current].slice(0, 20);
  writeRecentItems(userId, merged);
  return merged;
}

export function clearRecentItems(userId: string): void {
  if (!userId) return;
  localStorage.removeItem(storageKey(userId));
}
