/** Telegram tier cache — flattens checkSubscriptionAuth hot path */
type TierCache = Map<string, { tier: string; expires: number }>;
const cache: TierCache = new Map();
const TTL_MS = 5 * 60 * 1000;

export function getCachedTier(chatId: string): string | undefined {
  const entry = cache.get(chatId);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    cache.delete(chatId);
    return undefined;
  }
  return entry.tier;
}

export function setCachedTier(chatId: string, tier: string): void {
  cache.set(chatId, { tier, expires: Date.now() + TTL_MS });
}

export function invalidateTierCache(chatId: string): void {
  cache.delete(chatId);
}
