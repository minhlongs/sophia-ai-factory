/**
 * Auth and ownership verification helper for reseller tier manager actions.
 * @module land/partners/actions/tier-manager-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import type { PartnerProfile } from '@/tree/partners/types';
import type { ResellerActionError } from './reseller-types';

export interface VerifiedMasterContext {
  db: D1Database;
  masterPartnerId: string;
}

export async function verifyMasterPartnerOwnership(
  rawMasterPartnerId: string | undefined,
  options: {
    unauthorizedMessage: string;
    invalidInputMessage: string;
    forbiddenMessage: string;
  },
): Promise<Result<VerifiedMasterContext, ResellerActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: options.unauthorizedMessage });
  }

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
  }

  const masterPartnerId = rawMasterPartnerId?.trim();
  if (!masterPartnerId) {
    return failure({ code: 'INVALID_INPUT', message: options.invalidInputMessage });
  }

  const master = await db
    .prepare('SELECT id, user_id FROM partner_profiles WHERE id = ?')
    .bind(masterPartnerId)
    .first<PartnerProfile>();

  if (!master) {
    return failure({ code: 'NOT_FOUND', message: 'Master partner profile not found' });
  }

  if (master.user_id !== user.id) {
    return failure({ code: 'FORBIDDEN', message: options.forbiddenMessage });
  }

  return success({ db, masterPartnerId });
}
