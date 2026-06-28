/**
 * License context and dunning state fetchers for Enriched JWT
 * @module auth/enriched-jwt-billing
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { LicenseContext } from '@/seed/auth/enriched-jwt-types'

export async function getLicenseContext(licenseNonce: string): Promise<LicenseContext | null> {
  try {
    const db = createServerClient()
    const { data, error } = await db
      .from('raas_licenses')
      .select('tier, agency_id, expires_at, created_at')
      .eq('license_nonce', licenseNonce)
      .single()
    if (error || !data) {
      logger.error('[Enriched JWT] Failed to fetch license', toError(error))
      return null
    }
    const row = data as {
      tier: string; agency_id: string | null;
      expires_at: number | null; created_at: number;
    }
    return {
      tier: row.tier,
      agencyId: row.agency_id || undefined,
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
    return (data?.state as 'ok' | 'grace_period' | 'suspended' | 'delinquent') || 'grace_period'
  } catch (error) {
    logger.warn('[Enriched JWT] Failed to fetch dunning state', toError(error))
    return 'grace_period'
  }
}

