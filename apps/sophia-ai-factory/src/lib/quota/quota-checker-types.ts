import type { QuotaCheckResult } from '@/lib/usage-metering/types';

export type ExceededType = 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';

export interface CachedQuota {
  hourly: number;
  daily: number;
  monthly: number;
  requests: number;
  timestamp?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var KV_KV: {
    get: (key: string) => Promise<CachedQuota | null>;
    set: (key: string, value: CachedQuota, options?: { expirationTtl?: number }) => Promise<void>;
  } | undefined;
}

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
  polarCustomerId?: string;
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
