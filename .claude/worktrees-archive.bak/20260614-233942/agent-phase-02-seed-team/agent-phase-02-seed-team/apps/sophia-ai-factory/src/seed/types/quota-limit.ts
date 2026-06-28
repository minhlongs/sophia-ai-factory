/**
 * QuotaLimit primitive — seed layer (no forest dependency).
 *
 * Owns the canonical shape of per-tier quota limits used in JWT claims and
 * runtime enforcement. Forest re-exports this type for backward compatibility
 * (see `forest/usage-metering/types/quota-types.ts`).
 *
 * @module seed/types/quota-limit
 */
export interface QuotaLimit {
  tier: string;
  dailyCredits: number;
  hourlyCredits: number;
  dailyRequests: number;
  monthlyCredits: number;
}
