/**
 * QuotaProvider interface — DI contract for seed code that needs quota lookups
 * without importing forest (preserves seed layer purity).
 *
 * Implementations live in `forest/quota/*`. Composition root (route handler or
 * job) injects the implementation when calling seed APIs.
 *
 * @example
 *   import { createEnrichedJwt } from '@/seed/auth/enriched-jwt';
 *   const quotaProvider = { getEffectiveQuotaLimits };
 *   await createEnrichedJwt(userId, nonce, ttl, quotaProvider);
 *
 * @module seed/types/quota-provider
 */
import type { QuotaLimit } from './quota-limit';

export interface QuotaProvider {
  getEffectiveQuotaLimits(licenseNonce: string, tier: string): Promise<QuotaLimit>;
}
