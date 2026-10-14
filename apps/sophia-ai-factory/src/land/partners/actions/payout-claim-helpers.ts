/**
 * Partner ownership verification and pool lookup helpers for reseller license pool actions.
 * @module land/partners/actions/payout-claim-helpers
 */

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { failure, type Result } from '@/seed/types/result';
import { getLicensePoolById } from '@/tree/partners/license-pooling';
import type { PartnerProfile, PartnerLicensePool } from '@/tree/partners/types';
import type { ResellerActionError } from './reseller-types';

export async function verifyPartnerOwnerAccess(
  partnerId: string,
  unauthorizedMessage: string,
  forbiddenMessage: string,
): Promise<
  | { ok: true; db: D1Database; userId: string }
  | { ok: false; result: Result<never, ResellerActionError> }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      result: failure({ code: 'UNAUTHORIZED', message: unauthorizedMessage }),
    };
  }

  const db = await getD1();
  if (!db) {
    return {
      ok: false,
      result: failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' }),
    };
  }

  const partner = await db
    .prepare('SELECT id, user_id FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerProfile>();

  if (!partner) {
    return {
      ok: false,
      result: failure({ code: 'NOT_FOUND', message: 'Partner profile not found' }),
    };
  }

  if (partner.user_id !== user.id) {
    return {
      ok: false,
      result: failure({ code: 'FORBIDDEN', message: forbiddenMessage }),
    };
  }

  return { ok: true, db, userId: user.id };
}

export async function verifyPoolOwnerAccess(
  poolId: string,
): Promise<
  | { ok: true; db: D1Database; pool: PartnerLicensePool }
  | { ok: false; result: Result<never, ResellerActionError> }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      result: failure({ code: 'UNAUTHORIZED', message: 'Authentication required to allocate quota' }),
    };
  }

  const db = await getD1();
  if (!db) {
    return {
      ok: false,
      result: failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' }),
    };
  }

  const pool = await getLicensePoolById(db, poolId);
  if (!pool) {
    return {
      ok: false,
      result: failure({ code: 'NOT_FOUND', message: 'License pool not found' }),
    };
  }

  const partner = await db
    .prepare('SELECT id, user_id FROM partner_profiles WHERE id = ?')
    .bind(pool.partner_id)
    .first<PartnerProfile>();

  if (!partner || partner.user_id !== user.id) {
    return {
      ok: false,
      result: failure({ code: 'FORBIDDEN', message: 'Access denied to allocate from this pool' }),
    };
  }

  return { ok: true, db, pool };
}
