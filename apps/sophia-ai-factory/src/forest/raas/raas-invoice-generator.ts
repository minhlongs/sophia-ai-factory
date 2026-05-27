/**
 * RaaS Invoice Generator
 *
 * Handles subscription-lifecycle driven license operations:
 * revocation by Stripe subscription ID.
 *
 * @module raas/raas-invoice-generator
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { RaasLicenseRow as RaasLicense } from '@/lib/supabase/types';
import { logAuditAction, logLicenseRevocation } from './audit-logging-service';

/**
 * Revoke license by Stripe subscription ID
 * Supports soft revoke (access until period_end) and hard revoke (immediate)
 */
export async function revokeLicenseBySubscription(
  subscriptionId: string,
  options: {
    soft?: boolean;
    revokeAt?: number;
  } = {}
): Promise<RaasLicense | null> {
  const db = createServerClient();
  const revokedAt = options.revokeAt || Math.floor(Date.now() / 1000);
  const metadataKey = 'stripeSubscriptionId';

  const { data: rawLicense, error } = await db
    .from('raas_licenses')
    .select('*')
    .eq('metadata->>' + metadataKey, subscriptionId)
    .single();
  const license = rawLicense as RaasLicense | null;

  if (error || !license) {
    logger.warn(`License not found for subscription ${subscriptionId}`);
    return null;
  }

  const { data: rawUpdated, error: updateError } = await db
    .from('raas_licenses')
    .update({
      is_revoked: true,
      revoked_at: revokedAt,
      metadata: {
        ...(license.metadata as Record<string, unknown>),
        revoked_by_subscription: true,
        soft_revoke: options.soft ?? false,
      },
    })
    .eq('nonce', license.nonce)
    .select()
    .single();

  if (updateError) {
    logger.error(`Failed to revoke license ${license.nonce}`, toError(updateError));
    throw updateError;
  }

  await logLicenseRevocation({
    nonce: license.nonce,
    tier: license.tier,
    reason: options.soft ? 'subscription_cancelled' : 'subscription_expired',
  });

  logger.info(`License revoked for subscription ${subscriptionId}`, {
    nonce: license.nonce.slice(0, 8),
    softRevoke: options.soft,
  });

  // Double-cast: Supabase .update().select().single() return type is structurally
  // narrower than RaasLicenseRow (TS2352). `as unknown` first widens the cast.
  return rawUpdated as unknown as RaasLicense;
}
