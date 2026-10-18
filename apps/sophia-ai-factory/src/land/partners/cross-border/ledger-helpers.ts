/**
 * Cross-border ledger action helpers for auth and DB resolution
 * @module land/partners/cross-border/ledger-helpers
 */

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getPartnerByUserId } from '@/tree/partners/partner-service';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import type { CrossBorderActionError } from './types';
import type { D1Database } from '@cloudflare/workers-types';

export interface AuthResult {
  db: D1Database;
  partnerId: string;
}

export async function resolveCrossBorderAuth(): Promise<
  Result<AuthResult, CrossBorderActionError>
> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
  }

  const partner = await getPartnerByUserId(db, user.id);
  if (!partner) {
    return failure({ code: 'NOT_FOUND', message: 'Partner profile not found for user' });
  }

  return success({ db, partnerId: partner.id });
}

export function handleCrossBorderError(
  context: string,
  err: unknown,
): CrossBorderActionError {
  const error = toError(err);
  logger.error(`Failed to ${context}`, { error: error.message });
  return { code: `FETCH_${context.toUpperCase().replace(/\s+/g, '_')}_FAILED`, message: error.message };
}