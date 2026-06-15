import type { AiService } from './event-types';

/** Export options */
export interface ExportOptions {
  licenseNonce?: string;
  userId?: string;
  startTimestamp: number;
  endTimestamp: number;
  service?: AiService;
  format: 'json' | 'csv';
}

/** Credit calculation rule */
export interface CreditRule {
  type: 'per-call' | 'per-1k-tokens';
  credits?: number;
  creditsPer1k?: number;
}

/**
 * Quota limit configuration per tier.
 * Canonical definition moved to `@/seed/types/quota-limit` (mekong layer rule).
 * Re-exported here to preserve existing import sites in forest/land/test code.
 */
export type { QuotaLimit } from '@/seed/types/quota-limit';

/** Quota check result */
export interface QuotaCheckResult {
  allowed: boolean;
  remaining: {
    dailyCredits: number;
    hourlyCredits: number;
    dailyRequests: number;
    monthlyCredits: number;
  };
  exceeded?: {
    type: 'daily_credits' | 'hourly_credits' | 'daily_requests' | 'monthly_credits';
    limit: number;
    current: number;
  };
}

/** Atomic credit slot reservation result (mirrors VideoSlotReservation) */
export interface CreditSlotReservation {
  reserved: boolean;
  used: number;
  limit: number;
}
