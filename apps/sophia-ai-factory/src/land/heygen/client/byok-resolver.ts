import { getUserApiKey } from '@/tree/byok/user-api-key-store';
import { isByokEnabled } from '@/tree/byok/resolve-user-api-key';
import { HeyGenClient } from './heygen-service';

/**
 * Returns a HeyGenClient resolved via BYOK when possible.
 *
 * Resolution order:
 *   1. userId provided AND BYOK enabled → user's stored heygen key (getUserApiKey)
 *   2. userId provided, no user key     → env HEYGEN_API_KEY fallback
 *   3. no userId                        → env HEYGEN_API_KEY (cron / system path)
 *   4. no key at all                    → null (caller falls back to mock)
 */
export async function getHeyGenClient(userId?: string): Promise<HeyGenClient | null> {
  const envKey = process.env.HEYGEN_API_KEY ?? null;

  if (userId && isByokEnabled()) {
    const userKey = await getUserApiKey(userId, 'heygen');
    const apiKey = userKey ?? envKey;
    if (!apiKey) return null;
    return new HeyGenClient(apiKey);
  }

  if (!envKey) return null;
  return new HeyGenClient(envKey);
}
