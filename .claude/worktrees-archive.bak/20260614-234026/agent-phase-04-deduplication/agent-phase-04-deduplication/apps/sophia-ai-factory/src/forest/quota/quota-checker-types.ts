/**
 * Quota checker types
 *
 * Backward compat: QuotaCheckResult re-exported from seed/types/ (canonical location).
 */
import type { QuotaCheckResult } from '@/seed/types/quota-types';

export type ExceededType = 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';

export interface CachedQuota {
  hourly: number;
  daily: number;
  monthly: number;
  requests: number;
  timestamp?: number;
}

// KV_KV global is declared in jwt-nonce-storage.ts with unknown value type.
// Callers in this module cast to/from CachedQuota at usage sites.

export interface QuotaCheckContext {
  userId: string;
  licenseNonce: string;
  tier: string;
  requestedCredits: number;
  endpoint?: string;
  service?: string;
  action?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface QuotaConfig {
  softWarningThreshold: number;
  enableOverageBilling: boolean;
  failClosed: boolean;
}

export const DEFAULT_CONFIG: QuotaConfig = {
  softWarningThreshold: 0.8,
  enableOverageBilling: false,
  failClosed: true,
};

export interface EnhancedQuotaCheckResult extends QuotaCheckResult {
  warningThreshold?: boolean;
  softLimitReached?: boolean;
  overageAllowed?: boolean;
}
