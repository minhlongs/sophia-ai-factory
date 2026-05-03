/**
 * RaaS Invoice Generator
 *
 * Handles subscription-lifecycle driven license operations:
 * reactivation and revocation by subscription ID (Polar or Stripe).
 *
 * @module raas/raas-invoice-generator
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { RaasLicenseRow as RaasLicense } from '@/lib/supabase/types';
import { logAuditAction, logLicenseRevocation } from './audit-logging-service';

/**
 * Reactivate license by Polar subscription ID
 * Called when subscription becomes active after past_due
 */
export async function reactivateLicenseBySubscription(
  polarSubscriptionId: string
): Promise<RaasLicense | null> {
  const db = createServerClient();

  const { data: rawLicense, error } = await db
    .from('raas_licenses')
    .select('*')
    .eq('metadata->>polarSubscriptionId', polarSubscriptionId)
    .single();
  const license = rawLicense as RaasLicense | null;

  if (error || !license) {
    logger.warn(`License not found for Polar subscription ${polarSubscriptionId}`);
    return null;
  }

  const { data: rawUpdated, error: updateError } = await db
    .from('raas_licenses')
    .update({
      is_revoked: false,
      revoked_at: null,
      revoked_by: null,
      metadata: { ...(license.metadata as Record<string, unknown>), reactivated_at: Date.now() },
    })
    .eq('nonce', license.nonce)
    .select()
    .single();

  if (updateError) {
    logger.error(`Failed to reactivate license ${license.nonce}`, toError(updateError));
    throw updateError;
  }

  await logAuditAction({
    action: 'UPDATE',
    nonce: license.nonce,
    tier: license.tier,
    timestamp: Math.floor(Date.now() / 1000),
    details: { action: 'REACTIVATE', polarSubscriptionId },
  });

  logger.info(`License reactivated for Polar subscription ${polarSubscriptionId}`, {
    nonce: license.nonce.slice(0, 8),
  });

  // Double-cast: Supabase .update().select().single() return type is structurally
  // narrower than RaasLicenseRow (TS2352). `as unknown` first widens the cast.
  return rawUpdated as unknown as RaasLicense;
}

/**
 * Revoke license by subscription ID (Polar or Stripe)
 * Supports soft revoke (access until period_end) and hard revoke (immediate)
 */
export async function revokeLicenseBySubscription(
  subscriptionId: string,
  options: {
    soft?: boolean;
    revokeAt?: number;
    provider?: 'polar' | 'stripe';
  } = {}
): Promise<RaasLicense | null> {
  const db = createServerClient();
  const revokedAt = options.revokeAt || Math.floor(Date.now() / 1000);
  const metadataKey = options.provider === 'stripe' ? 'stripeSubscriptionId' : 'polarSubscriptionId';

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
