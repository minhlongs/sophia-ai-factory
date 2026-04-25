/**
 * JWT extraction helpers for Enhanced RaaS Gateway
 * @module raas-gateway-enhanced-jwt
 */

import type { NextRequest } from 'next/server'
import { logger } from './utils/logger-utility'
import { jwtVerify } from 'jose'
import { extractEnrichedClaims, type EnrichedJwtClaims, type ExtendedJwtPayload } from './security/jwt-validator'

export async function verifyJwtAndExtractEnrichedClaims(token: string): Promise<EnrichedJwtClaims | null> {
  try {
    const secret = new TextEncoder().encode(process.env.RAAS_JWT_SECRET || process.env.JWT_SECRET || '')
    const verified = await jwtVerify(token, secret)
    const payload = verified.payload as unknown as ExtendedJwtPayload

    if (payload.feature_entitlements && payload.license_nonce) {
      const enrichedClaims = extractEnrichedClaims(payload)
      if (enrichedClaims) {
        logger.info('[RaaS Gateway] Extracted enriched JWT claims', { userId: enrichedClaims.sub.slice(0, 8) + '...', licenseNonce: enrichedClaims.license_nonce.slice(0, 8) + '...', tier: enrichedClaims.license_tier, featureCount: enrichedClaims.feature_entitlements.length })
        return enrichedClaims
      }
    }

    const agencyId = verified.payload.agency_id as string
    if (agencyId) {
      return {
        sub: (verified.payload.sub as string) || '',
        iat: (verified.payload.iat as number) || 0,
        exp: (verified.payload.exp as number) || 0,
        agency_id: agencyId,
        license_nonce: (verified.payload.license_nonce as string) || '',
        license_tier: ((verified.payload.license_tier as 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER')) || 'BASIC',
        license_issued_at: (verified.payload.license_issued_at as number) || 0,
        feature_entitlements: [],
        feature_limits: {},
        quota: { tier: 'BASIC', dailyCredits: 0, hourlyCredits: 0, dailyRequests: 0, monthlyCredits: 0 },
      }
    }
    return null
  } catch (error) {
    logger.error('[RaaS Gateway] JWT verification failed', error instanceof Error ? error : new Error(String(error)))
    return null
  }
}

export async function extractAgencyId(request: NextRequest): Promise<string | null> {
  const agencyIdHeader = request.headers.get('x-raas-agency-id')
  if (agencyIdHeader) return agencyIdHeader

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (token.split('.').length === 3) {
      const enrichedClaims = await verifyJwtAndExtractEnrichedClaims(token)
      return enrichedClaims?.agency_id || null
    }
  }
  return null
}

export async function extractEnrichedClaimsFromRequest(request: NextRequest): Promise<EnrichedJwtClaims | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.substring(7)
  if (token.split('.').length !== 3) return null
  return verifyJwtAndExtractEnrichedClaims(token)
}
