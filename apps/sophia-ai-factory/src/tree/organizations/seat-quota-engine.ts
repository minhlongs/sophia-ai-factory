/**
 * Seat Quota Enforcement Engine
 *
 * Enforces organization member seat quotas based on subscription tier:
 * - Free: 1 seat (Solo)
 * - Starter: 1 seat (Solo)
 * - Pro: 5 seats (Team)
 * - Master: 999 seats (Enterprise / Agency)
 *
 * Allocation calculation:
 * allocated = activeMembers + pendingInvites (non-expired)
 * isAllowed = allocated < maxSeats
 *
 * Layer: tree/organizations (Pure domain logic - only imports from @/seed)
 *
 * @module tree/organizations/seat-quota-engine
 */

import type { D1Database } from '@/seed/db/client';
import { getMaxSeatsForTier, TIER_SEAT_LIMITS } from '@/seed/config/tiers/seat-quotas';
import type { SeatQuotaCheckResult } from '@/seed/types/org-invitations';

export { TIER_SEAT_LIMITS, type SeatQuotaCheckResult };

/**
 * Checks the current seat quota allocation for the specified organization.
 *
 * @throws {Error} with code 'ORGANIZATION_NOT_FOUND' if the organization does not exist.
 */
export async function checkSeatQuota(
  db: D1Database,
  orgId: string,
): Promise<SeatQuotaCheckResult> {
  if (!orgId || orgId.trim() === '') {
    throw new Error("ORGANIZATION_NOT_FOUND: Organization '' does not exist");
  }

  // 1. Fetch organization record
  const org = await db
    .prepare('SELECT * FROM organizations WHERE id = ?1 LIMIT 1')
    .bind(orgId)
    .first<{ id: string; tier?: string; max_seats?: number; plan?: string }>();

  if (!org) {
    throw new Error(`ORGANIZATION_NOT_FOUND: Org '${orgId}' does not exist`);
  }

  const effectiveTier = (org.tier ?? org.plan ?? 'free').toLowerCase();
  const maxSeats = org.max_seats ?? getMaxSeatsForTier(effectiveTier);

  // 2. Count active confirmed members (check organization_members first, then org_members fallback)
  let activeMembers = 0;
  try {
    const memRow = await db
      .prepare('SELECT COUNT(*) AS count FROM organization_members WHERE org_id = ?1')
      .bind(orgId)
      .first<{ count: number }>();
    if (memRow && Number(memRow.count) > 0) {
      activeMembers = Number(memRow.count);
    } else {
      try {
        const legacyMemRow = await db
          .prepare('SELECT COUNT(*) AS count FROM org_members WHERE org_id = ?1')
          .bind(orgId)
          .first<{ count: number }>();
        activeMembers = legacyMemRow ? Number(legacyMemRow.count) : Number(memRow?.count ?? 0);
      } catch {
        activeMembers = Number(memRow?.count ?? 0);
      }
    }
  } catch {
    try {
      const legacyMemRow = await db
        .prepare('SELECT COUNT(*) AS count FROM org_members WHERE org_id = ?1')
        .bind(orgId)
        .first<{ count: number }>();
      activeMembers = legacyMemRow ? Number(legacyMemRow.count) : 0;
    } catch {
      activeMembers = 0;
    }
  }

  // 3. Count pending, unexpired invitations
  let pendingInvites = 0;
  const now = Date.now();
  try {
    const invRow = await db
      .prepare(
        `SELECT COUNT(*) AS count 
         FROM organization_invitations 
         WHERE org_id = ?1 AND status = 'pending' AND expires_at > ?2`
      )
      .bind(orgId, now)
      .first<{ count: number }>();
    if (invRow && Number(invRow.count) > 0) {
      pendingInvites = Number(invRow.count);
    } else {
      try {
        const legacyInvRow = await db
          .prepare(
            `SELECT COUNT(*) AS count 
             FROM org_invitations 
             WHERE org_id = ?1 AND status = 'pending' AND expires_at > ?2`
          )
          .bind(orgId, now)
          .first<{ count: number }>();
        pendingInvites = legacyInvRow ? Number(legacyInvRow.count) : Number(invRow?.count ?? 0);
      } catch {
        pendingInvites = Number(invRow?.count ?? 0);
      }
    }
  } catch {
    try {
      const legacyInvRow = await db
        .prepare(
          `SELECT COUNT(*) AS count 
           FROM org_invitations 
           WHERE org_id = ?1 AND status = 'pending' AND expires_at > ?2`
        )
        .bind(orgId, now)
        .first<{ count: number }>();
      pendingInvites = legacyInvRow ? Number(legacyInvRow.count) : 0;
    } catch {
      pendingInvites = 0;
    }
  }

  const allocated = activeMembers + pendingInvites;
  const isAllowed = allocated < maxSeats;

  return {
    allocated,
    activeMembers,
    pendingInvites,
    maxSeats,
    isAllowed,
    tier: effectiveTier,
  };
}
