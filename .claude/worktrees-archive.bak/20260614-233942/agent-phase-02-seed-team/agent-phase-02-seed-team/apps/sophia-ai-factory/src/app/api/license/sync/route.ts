/**
 * License Sync API Endpoint
 * POST /api/license/sync
 * @module api/license/sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { RaasGatewayClient } from '@/forest/raas-gateway-client'
import { logAuditEvent } from '@/tree/audit/audit-logger'
import { verifyInternalSecret } from '@/seed/security/verify-internal-secret'
import type { SyncRequestBody, SyncResult } from './license-sync-types'
import { RAAS_CONFIG } from './license-sync-types'
import { syncFromDatabase, updateLicenseInDatabase, invalidateKvCache } from './license-sync-db'

async function syncFromGateway(licenseNonce: string, requestId: string): Promise<SyncResult> {
  try {
    const client = new RaasGatewayClient(RAAS_CONFIG)
    await client.authenticate()
    const licenses = await client.getLicenseUtilization()
    const license = licenses.find((l) => l.licenseNonce === licenseNonce)
    if (!license) throw new Error(`License ${licenseNonce.slice(0, 8)}... not found in RaaS Gateway`)

    const dbResult = await updateLicenseInDatabase(licenseNonce, license)
    const kvInvalidated = await invalidateKvCache(licenseNonce)

    logger.info('[License Sync] Gateway sync successful', { requestId, licenseNonce: licenseNonce.slice(0, 8) + '...', tier: license.tier, kvInvalidated })

    return {
      success: true,
      license: { nonce: license.licenseNonce, tier: license.tier, status: dbResult.status, expiresAt: license.expiresAt, featureEntitlements: dbResult.featureEntitlements, dunningState: dbResult.dunningState },
      syncSource: 'gateway',
      kvCacheInvalidated: kvInvalidated,
    }
  } catch (error) {
    logger.error('[License Sync] Gateway sync failed', toError(error), { requestId })
    logger.info('[License Sync] Falling back to database sync')
    const result = await syncFromDatabase(licenseNonce)
    return { ...result, syncSource: 'gateway-fallback-db' }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<SyncResult>> {
  const requestId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  if (!verifyInternalSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', syncSource: 'none', kvCacheInvalidated: false },
      { status: 401 }
    )
  }

  try {
    const body = await request.json() as SyncRequestBody

    if (!body.licenseNonce) {
      return NextResponse.json({ success: false, error: 'Missing licenseNonce in request body', syncSource: 'none', kvCacheInvalidated: false }, { status: 400 })
    }

    const { licenseNonce } = body
    logger.info('[License Sync] Starting sync', { requestId, licenseNonce: licenseNonce.slice(0, 8) + '...' })

    if (!RAAS_CONFIG.apiKey) {
      logger.warn('[License Sync] RAAS_API_KEY not configured, falling back to database')
      const result = await syncFromDatabase(licenseNonce)
      return NextResponse.json({ ...result, syncSource: 'database' })
    }

    const result = await syncFromGateway(licenseNonce, requestId)

    await logAuditEvent({
      action: 'license_sync',
      userId: 'system',
      metadata: { requestId, licenseNonce: licenseNonce.slice(0, 8) + '...', syncSource: result.syncSource, tier: result.license?.tier, kvCacheInvalidated: result.kvCacheInvalidated },
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('[License Sync] Sync failed', toError(error), { requestId })
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Sync failed', syncSource: 'none', kvCacheInvalidated: false }, { status: 500 })
  }
}
