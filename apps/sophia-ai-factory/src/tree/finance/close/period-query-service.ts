/**
 * Period Status & Aggregate Rollup Query Service
 * Layer: tree/finance
 *
 * @module tree/finance/close/period-query-service
 */

import type { D1Database } from '@/seed/db/client';
import type { FinancialClosePeriod, PeriodAggregates } from '@/seed/types/financial-close';
import type { RawPeriodRow } from './types';
import { mapRowToPeriod } from './period-mappers';

/**
 * Retrieve status of a financial close period
 */
export async function getPeriodStatus(
  db: D1Database,
  periodKey: string,
  orgId?: string | null
): Promise<FinancialClosePeriod | null> {
  let query = `SELECT * FROM financial_close_periods WHERE period_key = ?1`;
  const params: unknown[] = [periodKey];

  if (orgId !== undefined) {
    if (orgId === null) {
      query += ` AND org_id IS NULL`;
    } else {
      query += ` AND org_id = ?2`;
      params.push(orgId);
    }
  }
  query += ` LIMIT 1`;

  const row = await db.prepare(query).bind(...params).first<RawPeriodRow>();
  return row ? mapRowToPeriod(row) : null;
}

/**
 * Compute revenue and contract aggregates for a period
 */
export async function computePeriodAggregates(
  db: D1Database,
  periodKey: string,
  orgId?: string | null
): Promise<PeriodAggregates> {
  const period = await getPeriodStatus(db, periodKey, orgId);
  if (!period) {
    throw new Error(`Period ${periodKey} does not exist`);
  }

  let scheduleQuery = `
    SELECT
      COUNT(*) as active_contracts,
      COALESCE(SUM(recognized_revenue_cents), 0) as total_recognized,
      COALESCE(SUM(deferred_revenue_cents), 0) as total_deferred
    FROM revenue_schedules
    WHERE start_date <= ?1 AND end_date >= ?2
  `;
  const params: unknown[] = [period.endDate, period.startDate];

  if (orgId) {
    scheduleQuery += ` AND org_id = ?3`;
    params.push(orgId);
  }

  const result = await db.prepare(scheduleQuery).bind(...params).first<{
    active_contracts: number;
    total_recognized: number;
    total_deferred: number;
  }>();

  const recognized = Number(result?.total_recognized ?? 0);
  const deferred = Number(result?.total_deferred ?? 0);
  const activeContracts = Number(result?.active_contracts ?? 0);
  const refunds = 0; // standard refunds tracking
  const netRevenue = recognized - refunds;

  return {
    recognizedRevenueCents: recognized,
    deferredRevenueCents: deferred,
    refundsCents: refunds,
    netRevenueCents: netRevenue,
    activeContractsCount: activeContracts,
  };
}
