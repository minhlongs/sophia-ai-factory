/**
 * Amortization Schedule Calculation and Queries
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/finance/recognition/amortization-schedule
 */

import type { D1Database } from '@/seed/db/client';
import type {
  RevenueSchedule,
  RevenueScheduleTier,
  BillingCycle,
  ScheduleStatus,
  CreateScheduleInput,
} from '@/seed/types/financial-close';
import {
  CANONICAL_TIER_PRICES_CENTS,
  MASTER_ECONOMIC_LIFE_DAYS,
  formatDateIso,
  addDaysIso,
  diffCalendarDays,
  verifyScheduleInvariance,
  type RawScheduleRow,
} from './types';
import { mapRowToRevenueSchedule } from './compliance-audit';

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
