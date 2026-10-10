export const DEFAULT_LOCKOUT_MS = 0;
export const CONNECTION_FAILURE_THRESHOLD = 3;
export const CONNECTION_COOLDOWN_MS = 60_000;

export function breakerKey(service: string, keyRef = 'platform'): string {
  return `${service}:${keyRef}`;
}

export function splitCacheKey(cacheKey: string): [string, string] {
  const idx = cacheKey.indexOf(':');
  if (idx === -1) return [cacheKey, 'platform'];
  return [cacheKey.slice(0, idx), cacheKey.slice(idx + 1) || 'platform'];
}

export function isImmediateOpenStatus(status: number): boolean {
  return status === 401 || status === 403;
}
