/**
 * Schedule Row Mapper and Compliance Auditing
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/finance/recognition/compliance-audit
 */

import type { RevenueSchedule } from '@/seed/types/financial-close';
import type { RawScheduleRow } from './types';

/**
 * Maps database row to domain RevenueSchedule entity.
 */
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
