/**
 * Outcome-Based Pricing Engine
 *
 * Domain logic for calculating and recording RaaS billing events.
 * Fee = gross_revenue * (percentage / 100), default 15%.
 *
 * All timestamps are Unix epoch seconds (Math.floor(Date.now() / 1000)).
 * All money values are in cents (integer) to avoid floating-point errors.
 */

import { getD1Raw } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import type {
  BillingEvent,
  BillingStatus,
  CreatorBillingSummary,
  OutcomePricingTier,
} from '@/seed/types/outcome-pricing'

const DEFAULT_FEE_PERCENTAGE = 15.0

// ---------------------------------------------------------------------------
// Fee calculation (pure — no I/O)
// ---------------------------------------------------------------------------

export function calculateFee(
  grossRevenueCents: number,
  percentage = DEFAULT_FEE_PERCENTAGE,
): { feeCents: number; feePercentage: number } {
  const feeCents = Math.floor(grossRevenueCents * (percentage / 100))
  return { feeCents, feePercentage: percentage }
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export async function createBillingEvent(params: {
  userId: string
  executionId: string
  outcomeId?: string
  grossRevenueCents: number
  pricingTierId?: string
  percentage?: number
}): Promise<string> {
  const { userId, executionId, outcomeId, grossRevenueCents, pricingTierId, percentage } = params
  const { feeCents, feePercentage } = calculateFee(grossRevenueCents, percentage)
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  try {
    const db = await getD1Raw()
    await db
      .prepare(
        `INSERT INTO outcome_billing_events
          (id, user_id, execution_id, outcome_id, gross_revenue_cents,
           fee_cents, fee_percentage, pricing_tier_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .bind(
        id,
        userId,
        executionId,
        outcomeId ?? null,
        grossRevenueCents,
        feeCents,
        feePercentage,
        pricingTierId ?? null,
        now,
      )
      .run()

    logger.info('billing_event_created', { id, userId, feeCents, feePercentage })
    return id
  } catch (err) {
    logger.warn('billing_event_create_failed', { userId, executionId, error: getErrorMessage(err) })
    throw new Error(`Failed to create billing event: ${getErrorMessage(err)}`)
  }
}

export async function settleBillingEvent(eventId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  try {
    const db = await getD1Raw()
    await db
      .prepare(
        `UPDATE outcome_billing_events
         SET status = 'settled', settled_at = ?
         WHERE id = ? AND status != 'settled'`,
      )
      .bind(now, eventId)
      .run()
    logger.info('billing_event_settled', { eventId })
  } catch (err) {
    logger.warn('billing_event_settle_failed', { eventId, error: getErrorMessage(err) })
    throw new Error(`Failed to settle billing event: ${getErrorMessage(err)}`)
  }
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

export async function getCreatorBillingSummary(
  userId: string,
  opts?: { fromDate?: number; toDate?: number },
): Promise<CreatorBillingSummary> {
  const conditions: string[] = ['user_id = ?']
  const bindings: (string | number)[] = [userId]

  if (opts?.fromDate !== undefined) {
    conditions.push('created_at >= ?')
    bindings.push(opts.fromDate)
  }
  if (opts?.toDate !== undefined) {
    conditions.push('created_at <= ?')
    bindings.push(opts.toDate)
  }

  const where = conditions.join(' AND ')
  const period =
    opts?.fromDate || opts?.toDate
      ? `${opts?.fromDate ?? 0}-${opts?.toDate ?? 'now'}`
      : 'all-time'

  try {
    const db = await getD1Raw()
    const row = await db
      .prepare(
        `SELECT
           COALESCE(SUM(gross_revenue_cents), 0) AS total_gross,
           COALESCE(SUM(fee_cents), 0)           AS total_fees,
           COALESCE(SUM(CASE WHEN status = 'settled' THEN fee_cents ELSE 0 END), 0) AS total_settled,
           COALESCE(SUM(CASE WHEN status = 'pending'  THEN fee_cents ELSE 0 END), 0) AS pending_fees
         FROM outcome_billing_events
         WHERE ${where}`,
      )
      .bind(...bindings)
      .first<{
        total_gross: number
        total_fees: number
        total_settled: number
        pending_fees: number
      }>()

    return {
      userId,
      totalGrossRevenueCents: row?.total_gross ?? 0,
      totalFeesCents: row?.total_fees ?? 0,
      totalSettledCents: row?.total_settled ?? 0,
      pendingFeesCents: row?.pending_fees ?? 0,
      period,
    }
  } catch (err) {
    logger.warn('billing_summary_fetch_failed', { userId, error: getErrorMessage(err) })
    throw new Error(`Failed to fetch billing summary: ${getErrorMessage(err)}`)
  }
}

export async function getActivePricingTiers(): Promise<OutcomePricingTier[]> {
  try {
    const db = await getD1Raw()
    const result = await db
      .prepare(
        `SELECT id, name, percentage, min_revenue_cents, max_revenue_cents,
                is_active, created_at, updated_at
         FROM outcome_pricing_tiers
         WHERE is_active = 1
         ORDER BY min_revenue_cents ASC`,
      )
      .all<{
        id: string
        name: string
        percentage: number
        min_revenue_cents: number
        max_revenue_cents: number | null
        is_active: number
        created_at: number
        updated_at: number
      }>()

    return (result.results ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      percentage: row.percentage,
      minRevenueCents: row.min_revenue_cents,
      maxRevenueCents: row.max_revenue_cents ?? undefined,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  } catch (err) {
    logger.warn('pricing_tiers_fetch_failed', { error: getErrorMessage(err) })
    throw new Error(`Failed to fetch pricing tiers: ${getErrorMessage(err)}`)
  }
}

// Re-export types for consumers that only import from this module
export type { BillingEvent, BillingStatus, CreatorBillingSummary, OutcomePricingTier }
