'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getPartnerLicensePools } from '@/tree/partners/license-pooling';
import type { PartnerProfile, PartnerLicensePool } from '@/tree/partners/types';
import type { ResellerActionError } from './reseller-types';

/**
 * Retrieves all license pools for an authenticated partner.
 */
export async function getPartnerLicensePoolsAction(
  partnerId: string,
): Promise<Result<PartnerLicensePool[], ResellerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view license pools' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partner = await db
      .prepare('SELECT id, user_id FROM partner_profiles WHERE id = ?')
      .bind(partnerId)
      .first<PartnerProfile>();

    if (!partner || partner.user_id !== user.id) {
      return failure({ code: 'FORBIDDEN', message: 'Access denied to partner license pools' });
    }

    const pools = await getPartnerLicensePools(db, partnerId);
    return success(pools);
  } catch (rawError) {
    const err = toError(rawError);
    logger.error('Failed to list partner license pools', { error: err.message });
    return failure({ code: 'INTERNAL_ERROR', message: err.message });
  }
}
