/**
 * License Pool Queries and Deallocation
 *
 * Layer: tree (domain business logic & D1 operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/license-pool/pool-queries
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PartnerLicensePool } from '@/tree/partners/types';

/**
 * Retrieves a license pool by ID.
 */
export async function getLicensePoolById(
  db: D1Database,
  poolId: string,
): Promise<PartnerLicensePool | null> {
  return await db
    .prepare('SELECT * FROM partner_license_pools WHERE id = ?')
    .bind(poolId)
    .first<PartnerLicensePool>();
}

/**
 * Retrieves all license pools for a given partner.
 */
export async function getPartnerLicensePools(
  db: D1Database,
  partnerId: string,
): Promise<PartnerLicensePool[]> {
  const { results } = await db
    .prepare('SELECT * FROM partner_license_pools WHERE partner_id = ? ORDER BY created_at DESC')
    .bind(partnerId)
    .all<PartnerLicensePool>();

  return results || [];
}

/**
 * De-allocates or refunds unconsumed quota back to the license pool.
 */
export async function deallocatePoolQuota(
  db: D1Database,
  poolId: string,
  _subaccountId: string,
  seats: number,
  mcuCredits: number,
): Promise<{ success: boolean; remainingSeats: number; remainingMcu: number; error?: string }> {
  if (seats < 0 || mcuCredits < 0) {
    return { success: false, remainingSeats: 0, remainingMcu: 0, error: 'INVALID_AMOUNT' };
  }

  const now = Date.now();
  const res = await db
    .prepare(`
      UPDATE partner_license_pools
      SET allocated_seats = MAX(0, allocated_seats - ?1),
          allocated_mcu_credits = MAX(consumed_mcu_credits, allocated_mcu_credits - ?2),
          updated_at = ?3
      WHERE id = ?4 AND status IN ('active', 'exhausted')
    `)
    .bind(seats, mcuCredits, now, poolId)
    .run();

  if ((res.meta?.changes ?? 0) === 0) {
    return { success: false, remainingSeats: 0, remainingMcu: 0, error: 'POOL_NOT_FOUND' };
  }

  // Restore pool to active if it was exhausted
  await db
    .prepare("UPDATE partner_license_pools SET status = 'active' WHERE id = ? AND status = 'exhausted'")
    .bind(poolId)
    .run();

  const pool = await getLicensePoolById(db, poolId);
  return {
    success: true,
    remainingSeats: (pool?.total_seats ?? 0) - (pool?.allocated_seats ?? 0),
    remainingMcu: (pool?.total_mcu_credits ?? 0) - (pool?.allocated_mcu_credits ?? 0),
  };
}
