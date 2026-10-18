/**
 * Auth, DB, and partner ownership guard helper for Partner Co-Op Queries.
 *
 * Layer: land
 *
 * @module land/partners/actions/co-op-query-guard
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { failure, type Result } from '@/seed/types/result';
import { verifyPartnerOwnership } from './ownership-verifier';
import type { CoOpActionError } from './types';

export async function authorizeCoOpQueryContext(
  partnerId: string,
  unauthorizedMessage: string,
): Promise<
  | { ok: true; db: D1Database; trimmedPartnerId: string }
  | { ok: false; result: Result<never, CoOpActionError> }
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

  const trimmedPartnerId = partnerId?.trim();
  if (!trimmedPartnerId) {
    return {
      ok: false,
      result: failure({ code: 'INVALID_INPUT', message: 'partnerId is required' }),
    };
  }

  const authCheck = await verifyPartnerOwnership(db, trimmedPartnerId, user.id, user.role);
  if (!authCheck.ok) {
    return {
      ok: false,
      result: failure(authCheck.error),
    };
  }

  return { ok: true, db, trimmedPartnerId };
}
