import { lookupUserApiKey } from '@/tree/byok/user-api-key-store';
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
 *
 * A stored-key store or decryption failure fails closed (returns null) rather
 * than falling back to the platform env key, so an unknown credential is never
 * mistaken for a usable one.
 */
export async function getHeyGenClient(userId?: string): Promise<HeyGenClient | null> {
  const envKey = process.env.HEYGEN_API_KEY ?? null;

  if (userId && isByokEnabled()) {
    const lookup = await lookupUserApiKey(userId, 'heygen');
    // A store or decryption failure fails closed rather than falling back to
    // the platform key: an unknown credential must never be treated as usable.
    if (lookup.status !== 'FOUND' && lookup.status !== 'NOT_CONFIGURED') {
      return null;
    }
    const apiKey = lookup.status === 'FOUND' ? lookup.key : envKey;
    if (!apiKey) return null;
    return new HeyGenClient(apiKey);
  }

  if (!envKey) return null;
  return new HeyGenClient(envKey);
}
