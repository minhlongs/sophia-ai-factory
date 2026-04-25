/**
 * Enhanced RaaS Gateway with Enriched JWT Claims and Agency isolation
 * @module raas-gateway-enhanced
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { logger } from './utils/logger-utility'
import { validateLicenseKey as validateWithHmac, ValidationResult } from './raas-service'
import { logValidationWithReceipt, serializeReceiptForHeader } from './audit/audit-logger'
import { createServerClient } from '@/lib/db/client'
import { extractAgencyId, extractEnrichedClaimsFromRequest, verifyJwtAndExtractEnrichedClaims } from './raas-gateway-enhanced-jwt'
import type { EnrichedJwtClaims } from './security/jwt-validator'

export { extractEnrichedClaimsFromRequest } from './raas-gateway-enhanced-jwt'
export { raasGate, shouldApplyRaasGate, getRaaSConfig } from './raas-gate'

interface RaaSValidationResult {
  valid: boolean; reason?: string; tier?: string; agencyId?: string; enrichedClaims?: EnrichedJwtClaims
}

async function validateAgencyAccess(licenseNonce: string, agencyId: string): Promise<boolean> {
  try {
    const db = createServerClient()
    const { data: license } = await db.from('raas_licenses').select('id').eq('nonce', licenseNonce).eq('agency_id', agencyId).single()
    if (!license) { logger.warn('[RaaS Gateway] Cross-tenant access attempt blocked', { licenseNonce, requestingAgency: agencyId }); return false }
    return true
  } catch (error) {
    logger.error('[RaaS Gateway] Error validating agency access', error instanceof Error ? error : new Error(String(error))); return false
  }
}

async function validateLicenseKey(key: string | null): Promise<RaaSValidationResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (validateWithHmac as any)(key) as RaaSValidationResult
}

export async function validateLicenseKeyWithAgency(key: string | null, request: NextRequest): Promise<RaaSValidationResult> {
  const agencyId = await extractAgencyId(request)
  const enrichedClaims = await extractEnrichedClaimsFromRequest(request)
  const baseResult = await validateLicenseKey(key)
  if (!baseResult.valid) return baseResult

  if (enrichedClaims) {
    if (agencyId && enrichedClaims.agency_id && agencyId !== enrichedClaims.agency_id) {
      logger.warn('[RaaS Gateway] Agency ID mismatch with enriched claims', { requestAgency: agencyId, enrichedAgency: enrichedClaims.agency_id })
      return { valid: false, reason: 'agency-id-mismatch' }
    }
    const featureKey = request.headers.get('x-feature-key')
    if (featureKey && !enrichedClaims.feature_entitlements.includes(featureKey)) {
      logger.warn('[RaaS Gateway] Feature not in entitlements', { featureKey, tier: enrichedClaims.license_tier, userId: enrichedClaims.sub.slice(0, 8) + '...' })
      return { valid: false, reason: 'feature-not-entitled', tier: enrichedClaims.license_tier }
    }
    if (enrichedClaims.billing_status === 'suspended') {
      logger.warn('[RaaS Gateway] Access denied - account suspended', { userId: enrichedClaims.sub.slice(0, 8) + '...', licenseNonce: enrichedClaims.license_nonce.slice(0, 8) + '...' })
      return { valid: false, reason: 'account-suspended', tier: enrichedClaims.license_tier }
    }
    return { valid: true, tier: enrichedClaims.license_tier, agencyId: enrichedClaims.agency_id, enrichedClaims }
  }

  if (agencyId) {
    const hasAccess = await validateAgencyAccess('', agencyId)
    if (!hasAccess) return { valid: false, reason: 'cross-tenant-access-denied', agencyId }
    return { ...baseResult, agencyId }
  }

  if (process.env.REQUIRE_AGENCY_ID === 'true') {
    logger.warn('[RaaS Gateway] Missing agency_id in request where required')
    return { valid: false, reason: 'missing-agency-id' }
  }
  return baseResult
}

function extractLicenseKey(request: NextRequest): string | null {
  return request.headers.get('x-raas-license-key') || null
}

function createForbiddenResponse(reason: string): NextResponse {
  return NextResponse.json({ error: 'Forbidden', reason }, { status: 403 })
}

export async function raasGateWithAgency(request: NextRequest): Promise<{ valid: boolean; response?: NextResponse; tier?: string; agencyId?: string; receipt?: string; quotaWarning?: boolean; quotaRemaining?: { dailyCredits: number; hourlyCredits: number; dailyRequests: number; monthlyCredits: number } }> {
  const licenseKey = extractLicenseKey(request)
  const result = await validateLicenseKeyWithAgency(licenseKey, request)

  if (!result.valid) {
    await logValidationWithReceipt({ nonce: licenseKey || 'unknown', isValid: false, ipAddress: request.headers.get('x-forwarded-for') || undefined, userAgent: request.headers.get('user-agent') || undefined, tier: 'unknown' })
    logger.info('[RaaS Gateway] Validation failed', { path: request.nextUrl.pathname, valid: result.valid, reason: result.reason, agencyId: result.agencyId })
    return { valid: false, response: createForbiddenResponse(result.reason!) }
  }

  const receipt = await logValidationWithReceipt({ nonce: licenseKey!, isValid: true, userId: request.headers.get('x-logged-in-user-id') || undefined, ipAddress: request.headers.get('x-forwarded-for') || undefined, userAgent: request.headers.get('user-agent') || undefined, tier: result.tier })
  logger.info('[RaaS Gateway] Validation successful', { path: request.nextUrl.pathname, valid: result.valid, reason: result.reason, agencyId: result.agencyId, hasReceipt: !!receipt })

  return { valid: true, tier: result.tier, agencyId: result.agencyId, receipt: receipt ? serializeReceiptForHeader(receipt) : undefined }
}
