/**
 * enforce-tier-quota — back-compat re-export
 *
 * Implementation moved to forest/auth/enforce-tier-quota (M4 migration).
 * This module depends on forest/quota/video-quota, so it belongs in forest.
 *
 * @deprecated Import from @/forest/auth/enforce-tier-quota directly.
 */
export type { TierQuotaResult } from '@/forest/auth/enforce-tier-quota';
export { checkTierQuota } from '@/forest/auth/enforce-tier-quota';
