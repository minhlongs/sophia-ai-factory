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
  CreateLicensePoolResult,
} from '@/tree/partners/types';
import {
  validateCreatePoolInputs,
  buildLicensePoolRecord,
  type CreateLicensePoolOptions,
} from './pool-creator-helpers';

/**
 * Creates a new bulk license and MCU quota pool for a partner agency.
 */
export async function createLicensePool(
  db: D1Database,
  partnerId: string,
  poolName: string,
  seats: number,
  mcuCredits: number,
  unitPriceCents: number,
  options?: CreateLicensePoolOptions,
): Promise<CreateLicensePoolResult> {
  const validationError = validateCreatePoolInputs(poolName, seats, mcuCredits, unitPriceCents);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const trimmedName = poolName.trim();

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

  const createdPool = buildLicensePoolRecord({
    poolId: `pool_${crypto.randomUUID().slice(0, 16)}`,
    partnerId,
    trimmedName,
    seats,
    mcuCredits,
    unitPriceCents,
    options,
    now: Date.now(),
  });

  const result = await db
    .prepare(`
      INSERT INTO partner_license_pools (
        id, partner_id, pool_name, total_seats, allocated_seats,
        total_mcu_credits, allocated_mcu_credits, consumed_mcu_credits,
        unit_price_cents, auto_topup_enabled, auto_topup_threshold_mcu,
        auto_topup_amount_mcu, period_start, period_end, auto_renew,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `)
    .bind(
      createdPool.id,
      createdPool.partner_id,
      createdPool.pool_name,
      createdPool.total_seats,
      createdPool.total_mcu_credits,
      createdPool.unit_price_cents,
      createdPool.auto_topup_enabled,
      createdPool.auto_topup_threshold_mcu,
      createdPool.auto_topup_amount_mcu,
      createdPool.period_start,
      createdPool.period_end,
      createdPool.auto_renew,
      createdPool.created_at,
      createdPool.updated_at,
    )
    .run();

  if (!result.success) {
    return { success: false, error: 'DATABASE_INSERT_FAILED' };
  }

  return { success: true, pool: createdPool };
}
