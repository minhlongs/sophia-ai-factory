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

/** Quota limit configuration per tier */
export interface QuotaLimit {
  tier: string;
  dailyCredits: number;
  hourlyCredits: number;
  dailyRequests: number;
  monthlyCredits: number;
}

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
