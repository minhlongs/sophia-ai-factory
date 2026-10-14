/**
 * Quota Counter Helpers — KV key building, reset dates, and tier limits.
 * @module forest/worker/lib/quota-counter-helpers
 */

export interface QuotaResponse {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetDate: string;
  overage?: number;
}

export interface UsageData {
  current: number;
  limit: number;
  resetDate: string;
  lastUpdated: number;
}

export const TIER_LIMITS: Record<string, number> = {
  BASIC: 1000,
  PREMIUM: 10000,
  ENTERPRISE: 100000,
};

export function getMonthKey(apiKey: string, service: string): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `quota:${apiKey}:${service}:${year}-${month}`;
}

export function getResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}
