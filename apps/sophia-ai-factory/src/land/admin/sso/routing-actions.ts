'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  IdpRoutingMetadata,
  SsoActionError,
} from '@/seed/types/enterprise-sso';
import {
  resolveIdpRouting,
  normalizeCorporateDomain,
} from '@/tree/sso/enterprise-sso-service';

/**
 * Lookup IdP routing info for an email address (used during login redirection).
 * Publicly callable to allow unauthenticated corporate users to discover their IdP.
 */
export async function checkEmailSsoRoutingAction(
  email: string,
): Promise<Result<IdpRoutingMetadata | null, SsoActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const normalized = normalizeCorporateDomain(email);
  if (!normalized) {
    return success(null);
  }

  try {
    const routing = await resolveIdpRouting(db, email);
    return success(routing);
  } catch (err) {
    logger.error('[enterprise-sso-actions] Failed to resolve IdP routing', {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to resolve corporate login routing' });
  }
}
