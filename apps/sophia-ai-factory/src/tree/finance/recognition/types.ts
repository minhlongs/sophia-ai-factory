/**
 * Revenue Recognition Constants, Date Utilities and Schedule Types
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/finance/recognition/types
 */

import type {
  RevenueScheduleTier,
  BillingCycle,
  ScheduleStatus,
  AccountingStandard,
  RevenueSchedule,
} from '@/seed/types/financial-close';

// Canonical tier contract values in USD cents
export const CANONICAL_TIER_PRICES_CENTS: Record<RevenueScheduleTier, Record<BillingCycle, number>> = {
  BASIC: {
    monthly: 19900,   // $199/month
    annual: 199000,   // $1,990/year (10 months equivalent)
    lifetime: 19900,
    custom: 19900,
  },
  PREMIUM: {
    monthly: 39900,   // $399/month
    annual: 399000,   // $3,990/year
    lifetime: 39900,
    custom: 39900,
  },
  ENTERPRISE: {
    monthly: 79900,   // $799/month
    annual: 799000,   // $7,990/year
    lifetime: 79900,
    custom: 79900,
  },
  MASTER: {
    lifetime: 499900, // $4,999 lifetime license
    monthly: 499900,
    annual: 499900,
    custom: 499900,
  },
  CUSTOM: {
    monthly: 100000,
    annual: 1000000,
    lifetime: 1000000,
    custom: 100000,
  },
};

// Economic life duration in days for lifetime licenses (GAAP / ASC 606 customer relationship life)
export const MASTER_ECONOMIC_LIFE_DAYS = 1095; // 36 months = 3 * 365 days

export interface RawScheduleRow {
  id: string;
  org_id: string;
  user_id: string | null;
  contract_id: string;
  tier: RevenueScheduleTier;
  billing_cycle: BillingCycle;
  currency: string;
  total_contract_value_cents: number;
  recognized_revenue_cents: number;
  deferred_revenue_cents: number;
  daily_recognition_rate_cents: number;
  start_date: string;
  end_date: string;
  term_days: number;
  days_recognized: number;
  accounting_standard: AccountingStandard;
  status: ScheduleStatus;
  last_accrual_date: string | null;
  metadata_json: string;
  created_at: number;
  updated_at: number;
}

/**
 * Format a Date to 'YYYY-MM-DD'
 */
export function formatDateIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse 'YYYY-MM-DD' into UTC midnight Date
 */
export function parseDateIso(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10) - 1;
  const d = parseInt(dayStr, 10);
  return new Date(Date.UTC(y, m, d));
}

/**
 * Add days to a Date and return ISO string
 */
export function addDaysIso(dateStr: string, days: number): string {
  const dt = parseDateIso(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatDateIso(dt);
}

/**
 * Calculate difference in whole calendar days (inclusive of boundary)
 */
export function diffCalendarDays(startDateStr: string, endDateStr: string): number {
  const start = parseDateIso(startDateStr);
  const end = parseDateIso(endDateStr);
  const msDiff = end.getTime() - start.getTime();
  return Math.max(1, Math.round(msDiff / (1000 * 60 * 60 * 24)));
}

/**
 * Verify mathematical zero-leakage invariant:
 * totalContractValueCents == recognizedRevenueCents + deferredRevenueCents
 */
export function verifyScheduleInvariance(schedule: RevenueSchedule): boolean {
  if (schedule.recognizedRevenueCents < 0 || schedule.deferredRevenueCents < 0) {
    return false;
  }
  const sum = schedule.recognizedRevenueCents + schedule.deferredRevenueCents;
  return sum === schedule.totalContractValueCents;
}
