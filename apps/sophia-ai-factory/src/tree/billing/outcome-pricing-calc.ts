/**
 * Fee calculation and pricing tier query helpers.
 *
 * @module tree/billing/outcome-pricing-calc
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { OutcomePricingTier } from '@/seed/types/outcome-pricing';

export const DEFAULT_FEE_PERCENTAGE = 15.0;

/**
 * Fee calculation (pure — no I/O)
 */
export function calculateFee(
  grossRevenueCents: number,
  percentage = DEFAULT_FEE_PERCENTAGE,
): { feeCents: number; feePercentage: number } {
  const feeCents = Math.floor(grossRevenueCents * (percentage / 100));
  return { feeCents, feePercentage: percentage };
}

export async function getActivePricingTiers(): Promise<OutcomePricingTier[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    const result = await db
      .prepare(
        `SELECT id, name, percentage, min_revenue_cents, max_revenue_cents,
                is_active, created_at, updated_at
         FROM outcome_pricing_tiers
         WHERE is_active = 1
         ORDER BY min_revenue_cents ASC`,
      )
      .all<{
        id: string;
        name: string;
        percentage: number;
        min_revenue_cents: number;
        max_revenue_cents: number | null;
        is_active: number;
        created_at: number;
        updated_at: number;
      }>();

    return (result.results ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      percentage: row.percentage,
      minRevenueCents: row.min_revenue_cents,
      maxRevenueCents: row.max_revenue_cents ?? undefined,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    logger.warn('pricing_tiers_fetch_failed', { error: getErrorMessage(err) });
    throw new Error(`Failed to fetch pricing tiers: ${getErrorMessage(err)}`);
  }
}
