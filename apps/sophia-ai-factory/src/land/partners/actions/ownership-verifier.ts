/**
 * Partner Ownership Verifier (Anti-BOLA/IDOR Guard)
 *
 * Layer: land
 *
 * @module land/partners/actions/ownership-verifier
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PartnerOwnershipRecord, PartnerOwnershipResult } from './types';

/**
 * Validates that the authenticated user owns the target partner profile or is an admin.
 * Protects against Broken Object Level Authorization (BOLA / IDOR).
 */
export async function verifyPartnerOwnership(
  db: D1Database,
  partnerId: string,
  userOrId: { id: string; role?: string } | string,
  userRole?: string,
): Promise<PartnerOwnershipResult> {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
  const role = typeof userOrId === 'string' ? userRole : (userOrId.role ?? userRole);

  const partner = await db
    .prepare('SELECT id, user_id FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerOwnershipRecord>();

  if (!partner) {
    return { ok: false, success: false, error: { code: 'NOT_FOUND', message: 'Partner profile not found' } };
  }

  if (partner.user_id !== userId && role !== 'admin') {
    return { ok: false, success: false, error: { code: 'FORBIDDEN', message: 'Access denied to partner resources' } };
  }

  return { ok: true, success: true, value: partner };
}
