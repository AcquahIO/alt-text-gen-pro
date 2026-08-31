import { buildLocalizedPath, Locale, stripLocalePrefix } from '@/i18n/config';

export type RouteId = 'landing' | 'agentApi';

export const ROUTE_PATHS: Record<RouteId, string> = {
  landing: '/',
  agentApi: '/api/',
};

const INDEXABLE_ROUTES = new Set<RouteId>(['landing', 'agentApi']);

function normalizePath(pathname: string): string {
  const stripped = stripLocalePrefix(pathname || '/');
  if (stripped === '/') return '/';
  return stripped.replace(/\/+$/, '') || '/';
}

export function getRoutePath(routeId: RouteId): string {
  return ROUTE_PATHS[routeId];
}

export function buildRoutePath(locale: Locale, routeId: RouteId): string {
  return buildLocalizedPath(locale, getRoutePath(routeId));
}

export function detectRouteId(pathname: string): RouteId | null {
  const normalized = normalizePath(pathname);
  return (
    (Object.entries(ROUTE_PATHS).find(([, routePath]) => {
      const target = routePath === '/' ? '/' : routePath.replace(/\/+$/, '');
      return target === normalized;
    })?.[0] as RouteId | undefined) ?? null
  );
}

export function isIndexableRoute(routeId: RouteId): boolean {
  return INDEXABLE_ROUTES.has(routeId);
}
