/**
 * Manual license suspension and restoration helpers for dunning admin operations.
 * @module land/billing/dunning/dunning-license-lifecycle
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  getDunningState,
  transitionDunningState,
  type DunningStateResult,
} from './dunning-state-machine';
import { invalidateDunningCache } from './dunning-kv-cache';

/**
 * Manually suspend a license (admin action)
 */
export async function suspendLicense(
  licenseNonce: string,
  userId: string,
  reason: string,
): Promise<DunningStateResult> {
  await transitionDunningState(licenseNonce, userId, 'suspended');
  await invalidateDunningCache(licenseNonce);

  const db = createServerClient();
  await db.from('billing_events').insert({
    user_id: userId,
    license_nonce: licenseNonce,
    event_type: 'suspension_started',
    event_category: 'dunning',
    event_data: { reason, manual: true },
  });

  logger.warn('[Dunning] License manually suspended', { licenseNonce: licenseNonce.slice(0, 8), reason });

  return getDunningState(licenseNonce);
}

/**
 * Manually restore a license (admin action)
 */
export async function restoreLicense(
  licenseNonce: string,
  userId: string,
  reason: string,
): Promise<DunningStateResult> {
  await transitionDunningState(licenseNonce, userId, 'current');
  await invalidateDunningCache(licenseNonce);

  const db = createServerClient();
  await db.from('billing_events').insert({
    user_id: userId,
    license_nonce: licenseNonce,
    event_type: 'suspension_ended',
    event_category: 'dunning',
    event_data: { reason, manual: true },
  });

  logger.info('[Dunning] License manually restored', { licenseNonce: licenseNonce.slice(0, 8), reason });

  return getDunningState(licenseNonce);
}
