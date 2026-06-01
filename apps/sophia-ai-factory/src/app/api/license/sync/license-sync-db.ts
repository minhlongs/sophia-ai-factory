/**
 * DB and KV operations for License Sync
 * @module api/license/sync/license-sync-db
 */

import { createServerClient } from '@/seed/db/client'
import { getKvClient } from '@/land/redis'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { SyncResult } from './license-sync-types'

export async function syncFromDatabase(licenseNonce: string): Promise<SyncResult> {
  const db = createServerClient()
  try {
    const { data: license, error } = await db
      .from('raas_api_keys')
      .select('nonce, tier, status, expires_at, feature_entitlements, dunning_state')
      .eq('nonce', licenseNonce)
      .single() as { data: Record<string, unknown> | null; error: unknown }

    if (error || !license) throw new Error(`License ${licenseNonce.slice(0, 8)}... not found in database`)

    const formattedLicense = {
      nonce: license.nonce as string,
      tier: license.tier as string,
      status: (license.status as string) || 'active',
      expiresAt: license.expires_at ? new Date(license.expires_at as string).getTime() : null,
      featureEntitlements: (license.feature_entitlements as string[]) || [],
      dunningState: (license.dunning_state as string) || 'ok',
    }

    logger.info('[License Sync] Database sync successful', { licenseNonce: licenseNonce.slice(0, 8) + '...', tier: license.tier as string })
    return { success: true, license: formattedLicense, syncSource: 'database', kvCacheInvalidated: false }
  } catch (error) {
    logger.error('[License Sync] Database sync failed', toError(error)); throw error
  }
}

export async function updateLicenseInDatabase(
  licenseNonce: string,
  gatewayLicense: { licenseNonce: string; tier: string; expiresAt: number | null }
): Promise<{ status: string; featureEntitlements: string[]; dunningState: string }> {
  const db = createServerClient()
  const now = Date.now()
  let status = 'active'
  if (gatewayLicense.expiresAt) {
    if (gatewayLicense.expiresAt < now) status = 'expired'
    else if (gatewayLicense.expiresAt < now + 7 * 24 * 60 * 60 * 1000) status = 'expiring_soon'
  }

  const { data: updated, error } = await db
    .from('raas_api_keys')
    .upsert({ nonce: licenseNonce, tier: gatewayLicense.tier, status, expires_at: gatewayLicense.expiresAt ? new Date(gatewayLicense.expiresAt).toISOString() : null, updated_at: new Date().toISOString() })
    .select('feature_entitlements, dunning_state')
    .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error) {
    logger.warn('[License Sync] Database update failed', { message: error.message })
    throw new Error(`Failed to update license in database: ${error.message}`)
  }

  return {
    status,
    featureEntitlements: (updated?.feature_entitlements as string[]) || [],
    dunningState: (updated?.dunning_state as string) || 'ok',
  }
}

export async function invalidateKvCache(licenseNonce: string): Promise<boolean> {
  try {
    const kv = getKvClient()
    if (!kv) { logger.debug('[License Sync] KV client not available, skipping cache invalidation'); return false }
    await kv.set(`license:${licenseNonce}`, null)
    logger.debug('[License Sync] KV cache invalidated', { licenseNonce: licenseNonce.slice(0, 8) + '...' })
    return true
  } catch (error) {
    logger.error('[License Sync] KV cache invalidation failed', toError(error)); return false
  }
}
