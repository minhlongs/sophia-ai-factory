/**
 * ASC 606 / IFRS 15 SaaS Revenue Recognition Engine
 *
 * Implements 5-step ratable revenue recognition, straight-line economic life
 * amortization for lifetime licenses (MASTER tier over 36 months / 1,095 days),
 * daily accrual processing, and zero-leakage invariant verification.
 *
 * Invariance Law: totalContractValueCents == recognizedRevenueCents + deferredRevenueCents
 *
 * Layer: tree (Pure domain logic, depends only on @/seed and @/tree)
 *
 * @module tree/finance/revenue-recognition-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  RevenueSchedule,
  RevenueScheduleTier,
  BillingCycle,
  ScheduleStatus,
  AccountingStandard,
  CreateScheduleInput,
  AccrualRunResult,
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
 * Calculate contract terms, term days, end date, and daily accrual rate
 */
export function calculateTierContractTerms(
  tier: RevenueScheduleTier,
  billingCycle: BillingCycle,
  customValueCents?: number,
  startDateStr?: string,
  endDateStr?: string,
): {
  totalValueCents: number;
  termDays: number;
  dailyRateCents: number;
  startDate: string;
  endDate: string;
} {
  const startDate = startDateStr ?? formatDateIso(new Date());

  let totalValueCents = customValueCents;
  if (totalValueCents === undefined || totalValueCents <= 0) {
    const tierCycleMap = CANONICAL_TIER_PRICES_CENTS[tier] ?? CANONICAL_TIER_PRICES_CENTS.BASIC;
    totalValueCents = tierCycleMap[billingCycle] ?? 19900;
  }

  let termDays: number;
  let endDate: string;

  if (tier === 'MASTER' || billingCycle === 'lifetime') {
    termDays = MASTER_ECONOMIC_LIFE_DAYS;
    endDate = endDateStr ?? addDaysIso(startDate, termDays);
  } else if (billingCycle === 'annual') {
    termDays = 365;
    endDate = endDateStr ?? addDaysIso(startDate, termDays);
  } else if (billingCycle === 'monthly') {
    termDays = 30;
    endDate = endDateStr ?? addDaysIso(startDate, termDays);
  } else {
    if (endDateStr) {
      endDate = endDateStr;
      termDays = diffCalendarDays(startDate, endDateStr);
    } else {
      termDays = 30;
      endDate = addDaysIso(startDate, termDays);
    }
  }

  const dailyRateCents = totalValueCents / termDays;

  return {
    totalValueCents,
    termDays,
    dailyRateCents,
    startDate,
    endDate,
  };
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

interface RawScheduleRow {
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

export function mapRowToRevenueSchedule(row: RawScheduleRow): RevenueSchedule {
  let parsedMetadata: Record<string, unknown> = {};
  try {
    parsedMetadata = JSON.parse(row.metadata_json || '{}') as Record<string, unknown>;
  } catch {
    parsedMetadata = {};
  }

  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    contractId: row.contract_id,
    tier: row.tier,
    billingCycle: row.billing_cycle,
    currency: row.currency,
    totalContractValueCents: Number(row.total_contract_value_cents),
    recognizedRevenueCents: Number(row.recognized_revenue_cents),
    deferredRevenueCents: Number(row.deferred_revenue_cents),
    dailyRecognitionRateCents: Number(row.daily_recognition_rate_cents),
    startDate: row.start_date,
    endDate: row.end_date,
    termDays: Number(row.term_days),
    daysRecognized: Number(row.days_recognized),
    accountingStandard: row.accounting_standard,
    status: row.status,
    lastAccrualDate: row.last_accrual_date,
    metadataJson: parsedMetadata,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

/**
 * Create a new ASC 606 revenue recognition schedule in D1
 */
export async function createRevenueSchedule(
  db: D1Database,
  input: CreateScheduleInput,
): Promise<RevenueSchedule> {
  const terms = calculateTierContractTerms(
    input.tier,
    input.billingCycle,
    input.customContractValueCents,
    input.startDate,
    input.endDate,
  );

  const id = crypto.randomUUID().replace(/-/g, '').toLowerCase();
  const currency = input.currency ?? 'USD';
  const accountingStandard = input.accountingStandard ?? 'ASC_606_IFRS_15';
  const metadataJson = JSON.stringify(input.metadata ?? {});
  const now = Date.now();

  const initialRecognized = 0;
  const initialDeferred = terms.totalValueCents;

  await db
    .prepare(
      `INSERT INTO revenue_schedules (
        id, org_id, user_id, contract_id, tier, billing_cycle, currency,
        total_contract_value_cents, recognized_revenue_cents, deferred_revenue_cents,
        daily_recognition_rate_cents, start_date, end_date, term_days,
        days_recognized, accounting_standard, status, last_accrual_date,
        metadata_json, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)`
    )
    .bind(
      id,
      input.orgId,
      input.userId ?? null,
      input.contractId,
      input.tier,
      input.billingCycle,
      currency,
      terms.totalValueCents,
      initialRecognized,
      initialDeferred,
      terms.dailyRateCents,
      terms.startDate,
      terms.endDate,
      terms.termDays,
      0,
      accountingStandard,
      'active',
      null,
      metadataJson,
      now,
      now,
    )
    .run();

  const created = await getScheduleById(db, id);
  if (!created) {
    throw new Error(`Failed to retrieve newly created revenue schedule: ${id}`);
  }

  if (!verifyScheduleInvariance(created)) {
    throw new Error(`Schedule invariance violation on creation: ${id}`);
  }

  return created;
}

/**
 * Retrieve a revenue schedule by its ID
 */
export async function getScheduleById(
  db: D1Database,
  id: string,
): Promise<RevenueSchedule | null> {
  const row = await db
    .prepare(`SELECT * FROM revenue_schedules WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<RawScheduleRow>();

  if (!row) return null;
  return mapRowToRevenueSchedule(row);
}

/**
 * List revenue schedules for an organization, optionally filtered by status
 */
export async function listSchedulesByOrg(
  db: D1Database,
  orgId: string,
  status?: ScheduleStatus,
): Promise<RevenueSchedule[]> {
  let query = `SELECT * FROM revenue_schedules WHERE org_id = ?1`;
  const params: unknown[] = [orgId];

  if (status) {
    query += ` AND status = ?2`;
    params.push(status);
  }
  query += ` ORDER BY created_at DESC`;

  const { results } = await db.prepare(query).bind(...params).all<RawScheduleRow>();
  return (results ?? []).map(mapRowToRevenueSchedule);
}

/**
 * Process ratable daily accruals up to the given asOfDate across all active schedules.
 * Enforces Zero Penny Leakage: on or past the final day, recognizes all remaining deferred cents.
 */
export async function processDailyAccrual(
  db: D1Database,
  asOfDate: string,
): Promise<AccrualRunResult> {
  const { results } = await db
    .prepare(
      `SELECT * FROM revenue_schedules
       WHERE status = 'active'
         AND start_date <= ?1
         AND (last_accrual_date IS NULL OR last_accrual_date < ?1)`
    )
    .bind(asOfDate)
    .all<RawScheduleRow>();

  const activeSchedules = (results ?? []).map(mapRowToRevenueSchedule);

  let schedulesAccrued = 0;
  let totalAccruedCents = 0;
  let invarianceViolations = 0;
  let completedCount = 0;
  const now = Date.now();

  for (const schedule of activeSchedules) {
    // Calculate elapsed days from start_date to asOfDate (inclusive of start date: day 1 on start date)
    const start = parseDateIso(schedule.startDate);
    const target = parseDateIso(asOfDate);
    const msDiff = target.getTime() - start.getTime();
    if (msDiff < 0) {
      continue; // Not yet started
    }

    const elapsedDays = Math.floor(msDiff / (1000 * 60 * 60 * 24)) + 1;
    const effectiveDays = Math.min(schedule.termDays, elapsedDays);

    let targetRecognizedCents = 0;
    let targetDeferredCents = 0;
    let nextStatus: ScheduleStatus = 'active';

    if (effectiveDays >= schedule.termDays) {
      // Completed schedule: zero penny leakage guarantee
      targetRecognizedCents = schedule.totalContractValueCents;
      targetDeferredCents = 0;
      nextStatus = 'completed';
      completedCount++;
    } else {
      // Ratable straight-line accrual
      targetRecognizedCents = Math.min(
        schedule.totalContractValueCents,
        Math.round(effectiveDays * (schedule.totalContractValueCents / schedule.termDays))
      );
      targetDeferredCents = schedule.totalContractValueCents - targetRecognizedCents;
    }

    const deltaCents = targetRecognizedCents - schedule.recognizedRevenueCents;
    if (deltaCents > 0) {
      totalAccruedCents += deltaCents;
      schedulesAccrued++;
    }

    // Invariance verification
    if (targetRecognizedCents + targetDeferredCents !== schedule.totalContractValueCents) {
      invarianceViolations++;
      throw new Error(
        `Invariant failure in schedule ${schedule.id}: total ${schedule.totalContractValueCents} != ${targetRecognizedCents} + ${targetDeferredCents}`
      );
    }

    await db
      .prepare(
        `UPDATE revenue_schedules
         SET recognized_revenue_cents = ?1,
             deferred_revenue_cents = ?2,
             days_recognized = ?3,
             status = ?4,
             last_accrual_date = ?5,
             updated_at = ?6
         WHERE id = ?7`
      )
      .bind(
        targetRecognizedCents,
        targetDeferredCents,
        effectiveDays,
        nextStatus,
        asOfDate,
        now,
        schedule.id,
      )
      .run();
  }

  return {
    asOfDate,
    schedulesEvaluated: activeSchedules.length,
    schedulesAccrued,
    totalAccruedCents,
    invarianceViolationsCount: invarianceViolations,
    completedSchedulesCount: completedCount,
  };
}
