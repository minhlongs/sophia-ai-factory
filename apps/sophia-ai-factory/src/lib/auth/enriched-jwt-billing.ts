/**
 * License context, dunning state, and Polar billing fetchers for Enriched JWT
 * @module auth/enriched-jwt-billing
 */

import { createServerClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import type { LicenseContext } from './enriched-jwt-types'

export async function getLicenseContext(licenseNonce: string): Promise<LicenseContext | null> {
  try {
    const db = createServerClient()
    const { data, error } = await db
      .from('raas_licenses')
      .select('tier, agency_id, polar_customer_id, polar_subscription_id, polar_subscription_status, expires_at, created_at')
      .eq('license_nonce', licenseNonce)
      .single()
    if (error || !data) {
      logger.error('[Enriched JWT] Failed to fetch license', toError(error))
      return null
    }
    const row = data as {
      tier: string; agency_id: string | null; polar_customer_id: string | null;
      polar_subscription_id: string | null; polar_subscription_status: string | null;
      expires_at: number | null; created_at: number;
    }
    return {
      tier: row.tier,
      agencyId: row.agency_id || undefined,
      polarCustomerId: row.polar_customer_id || undefined,
      polarSubscriptionId: row.polar_subscription_id || undefined,
      polarStatus: row.polar_subscription_status || undefined,
      expiresAt: row.expires_at ? row.expires_at * 1000 : undefined,
      createdAt: row.created_at,
    }
  } catch (error) {
    logger.error('[Enriched JWT] Error fetching license context', toError(error))
    return null
  }
}

export async function fetchDunningState(
  licenseNonce: string,
): Promise<'ok' | 'grace_period' | 'suspended' | 'delinquent'> {
  try {
    const db = createServerClient()
    const { data } = await db
      .from('dunning_states')
      .select('state')
      .eq('license_nonce', licenseNonce)
      .single()
    return (data?.state as 'ok' | 'grace_period' | 'suspended' | 'delinquent') || 'ok'
  } catch (error) {
    logger.warn('[Enriched JWT] Failed to fetch dunning state', toError(error))
    return 'ok'
  }
}

export async function fetchPolarBillingStatus(
  polarCustomerId?: string,
): Promise<{ billingStatus?: 'active' | 'past_due' | 'suspended'; isPaid?: boolean; overageAllowed?: boolean } | null> {
  if (!polarCustomerId) return null
  try {
    const db = createServerClient()
    const { data } = await db
      .from('user_profiles')
      .select('subscription_status, subscription_tier')
      .eq('polar_customer_id', polarCustomerId)
      .single()
    if (!data) return null
    const statusMap: Record<string, 'active' | 'past_due' | 'suspended' | undefined> = {
      'active': 'active', 'past_due': 'past_due',
      'suspended': 'suspended', 'canceled': 'suspended', 'inactive': 'suspended',
    }
    const subscriptionStatus = data.subscription_status as string | undefined
    const subscriptionTier = data.subscription_tier as string | undefined
    return {
      billingStatus: statusMap[subscriptionStatus || ''] || 'active',
      isPaid: subscriptionStatus === 'active',
      overageAllowed: subscriptionTier === 'enterprise' || subscriptionTier === 'master',
    }
  } catch (error) {
    logger.warn('[Enriched JWT] Failed to fetch Polar billing status', toError(error))
    return null
  }
}
