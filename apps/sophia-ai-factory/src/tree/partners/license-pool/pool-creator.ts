/**
 * License Pool Creation Logic
 *
 * Layer: tree (domain business logic & D1 operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/license-pool/pool-creator
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerProfile,
  PartnerLicensePool,
  CreateLicensePoolResult,
} from '@/tree/partners/types';

/**
 * Creates a new bulk license and MCU quota pool for a partner agency.
 *
 * @param db - D1Database instance.
 * @param partnerId - ID of the partner profile owning this pool.
 * @param poolName - Descriptive name of the pool (e.g. "APAC Enterprise Q3 Pool").
 * @param seats - Total client seats provisioned.
 * @param mcuCredits - Total Model Compute Unit credits provisioned.
 * @param unitPriceCents - Cost basis in cents per unit.
 * @param options - Additional options including auto-topup and period constraints.
 */
export async function createLicensePool(
  db: D1Database,
  partnerId: string,
  poolName: string,
  seats: number,
  mcuCredits: number,
  unitPriceCents: number,
  options?: {
    autoTopupEnabled?: boolean;
    autoTopupThresholdMcu?: number;
    autoTopupAmountMcu?: number;
    periodStart?: number;
    periodEnd?: number;
    autoRenew?: boolean;
  },
): Promise<CreateLicensePoolResult> {
  const trimmedName = poolName?.trim();
  if (!trimmedName || trimmedName.length < 2) {
    return { success: false, error: 'INVALID_POOL_NAME' };
  }

  if (seats <= 0 || !Number.isInteger(seats)) {
    return { success: false, error: 'INVALID_SEATS_COUNT' };
  }

  if (mcuCredits <= 0 || !Number.isInteger(mcuCredits)) {
    return { success: false, error: 'INVALID_MCU_CREDITS' };
  }

  if (unitPriceCents < 0 || !Number.isInteger(unitPriceCents)) {
    return { success: false, error: 'INVALID_UNIT_PRICE' };
  }

  // Verify partner exists and is active
  const partner = await db
    .prepare('SELECT id, status FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerProfile>();

  if (!partner) {
    return { success: false, error: 'PARTNER_NOT_FOUND' };
  }

  if (partner.status !== 'active') {
    return {
      success: false,
      error: partner.status === 'suspended' ? 'PARTNER_SUSPENDED' : 'PARTNER_NOT_ACTIVE',
    };
  }

  const poolId = `pool_${crypto.randomUUID().slice(0, 16)}`;
  const now = Date.now();
  const autoTopupEnabled = options?.autoTopupEnabled ? 1 : 0;
  const autoTopupThresholdMcu = options?.autoTopupThresholdMcu ?? 0;
  const autoTopupAmountMcu = options?.autoTopupAmountMcu ?? 0;
  const periodStart = options?.periodStart ?? null;
  const periodEnd = options?.periodEnd ?? null;
  const autoRenew = options?.autoRenew ? 1 : 0;

  const result = await db
    .prepare(`
      INSERT INTO partner_license_pools (
        id,
        partner_id,
        pool_name,
        total_seats,
        allocated_seats,
        total_mcu_credits,
        allocated_mcu_credits,
        consumed_mcu_credits,
        unit_price_cents,
        auto_topup_enabled,
        auto_topup_threshold_mcu,
        auto_topup_amount_mcu,
        period_start,
        period_end,
        auto_renew,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 0, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `)
    .bind(
      poolId,
      partnerId,
      trimmedName,
      seats,
      mcuCredits,
      unitPriceCents,
      autoTopupEnabled,
      autoTopupThresholdMcu,
      autoTopupAmountMcu,
      periodStart,
      periodEnd,
      autoRenew,
      now,
      now,
    )
    .run();

  if (!result.success) {
    return { success: false, error: 'DATABASE_INSERT_FAILED' };
  }

  const createdPool: PartnerLicensePool = {
    id: poolId,
    partner_id: partnerId,
    pool_name: trimmedName,
    total_seats: seats,
    allocated_seats: 0,
    total_mcu_credits: mcuCredits,
    allocated_mcu_credits: 0,
    consumed_mcu_credits: 0,
    unit_price_cents: unitPriceCents,
    auto_topup_enabled: autoTopupEnabled,
    auto_topup_threshold_mcu: autoTopupThresholdMcu,
    auto_topup_amount_mcu: autoTopupAmountMcu,
    period_start: periodStart,
    period_end: periodEnd,
    auto_renew: autoRenew,
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  return { success: true, pool: createdPool };
}
