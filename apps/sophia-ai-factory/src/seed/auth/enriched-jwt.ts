/**
 * JWT Claims Enrichment Service
 *
 * Issues JWTs with embedded license metadata for fast Cloudflare Worker enforcement.
 *
 * Sub-modules:
 *   enriched-jwt-types.ts        — FeatureLimit, EnrichedJwtPayload, LicenseContext
 *   enriched-jwt-entitlements.ts — getDefaultEntitlements, getFeatureLimits
 *   enriched-jwt-billing.ts      — getLicenseContext, fetchDunningState, fetchPolarBillingStatus
 *
 * @module auth/enriched-jwt
 */

import { SignJWT, jwtVerify } from 'jose'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- mekong-exempt: lib/auth allowed to import forest types
import { getEffectiveQuotaLimits } from '@/forest/quota/quota-checker'
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- mekong-exempt: lib/auth allowed to import forest types
import type { QuotaLimit } from '@/forest/usage-metering/types'

export type { FeatureLimit, EnrichedJwtPayload, EnrichedJwtClaims, LicenseContext } from './enriched-jwt-types'
export { getDefaultEntitlements } from './enriched-jwt-entitlements'
export { getLicenseContext } from './enriched-jwt-billing'

import type { EnrichedJwtPayload } from '@/seed/auth/enriched-jwt-types'
import { getDefaultEntitlements, getFeatureLimits } from '@/seed/auth/enriched-jwt-entitlements'
import { getLicenseContext, fetchDunningState, fetchPolarBillingStatus } from '@/seed/auth/enriched-jwt-billing'

const JWT_CONFIG = { algorithm: 'HS256' as const, ttlSeconds: 3600 }

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET=REDACTED
  if (!secret) {
    logger.warn('[Enriched JWT] JWT_SECRET=REDACTED not set, using insecure default')
    return new TextEncoder().encode('insecure-dev-secret-change-in-production')
  }
  return new TextEncoder().encode(secret)
}

export async function createEnrichedJwt(
  userId: string,
  licenseNonce: string,
  ttlSeconds: number = JWT_CONFIG.ttlSeconds,
): Promise<{ token: string; payload: EnrichedJwtPayload } | null> {
  try {
    const licenseContext = await getLicenseContext(licenseNonce)
    if (!licenseContext) return null

    const quota = await getEffectiveQuotaLimits(licenseNonce, licenseContext.tier)
    const dunningState = await fetchDunningState(licenseNonce)
    const polarBilling = await fetchPolarBillingStatus(licenseContext.polarCustomerId)
    const featureEntitlements = getDefaultEntitlements(licenseContext.tier)
    const featureLimits = getFeatureLimits(licenseContext.tier)
    const jti = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    const payload: EnrichedJwtPayload = {
      sub: userId, iat: now, exp: now + ttlSeconds, jti,
      license_nonce: licenseNonce,
      license_tier: licenseContext.tier as EnrichedJwtPayload['license_tier'],
      license_issued_at: licenseContext.createdAt,
      license_expires_at: licenseContext.expiresAt,
      quota,
      agency_id: licenseContext.agencyId,
      polar_customer_id: licenseContext.polarCustomerId,
      polar_subscription_id: licenseContext.polarSubscriptionId,
      polar_subscription_status: licenseContext.polarStatus as EnrichedJwtPayload['polar_subscription_status'],
      billing_status: polarBilling?.billingStatus || 'active',
      is_paid: polarBilling?.isPaid ?? true,
      overage_allowed: polarBilling?.overageAllowed || false,
      dunning_state: dunningState,
      feature_entitlements: featureEntitlements,
      feature_limits: featureLimits,
    }

    const token = await new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: JWT_CONFIG.algorithm })
      .setIssuedAt(now)
      .setExpirationTime(now + ttlSeconds)
      .setJti(jti)
      .sign(getJwtSecret())

    logger.info('[Enriched JWT] Created enriched JWT', {
      userId, licenseNonce: licenseNonce.slice(0, 8) + '...',
      tier: licenseContext.tier,
      expiresAt: new Date((now + ttlSeconds) * 1000).toISOString(),
      featureCount: featureEntitlements.length,
    })
    return { token, payload }
  } catch (error) {
    logger.error('[Enriched JWT] Failed to create JWT', toError(error))
    return null
  }
}

export async function verifyEnrichedJwt(token: string): Promise<EnrichedJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [JWT_CONFIG.algorithm],
      clockTolerance: 60,
    })
    return payload as unknown as EnrichedJwtPayload
  } catch (error) {
    logger.warn('[Enriched JWT] JWT verification failed', toError(error))
    return null
  }
}

export function decodeEnrichedJwt(token: string): EnrichedJwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8')
    return JSON.parse(payloadStr) as EnrichedJwtPayload
  } catch {
    return null
  }
}

export function extractQuotaFromJwt(payload: EnrichedJwtPayload): QuotaLimit {
  return payload.quota
}

export function isJwtExpired(token: string): boolean {
  const payload = decodeEnrichedJwt(token)
  if (!payload) return true
  return payload.exp < Math.floor(Date.now() / 1000)
}

export async function refreshJwtIfExpired(token: string): Promise<string> {
  if (!isJwtExpired(token)) return token
  const payload = decodeEnrichedJwt(token)
  if (!payload) throw new Error('Invalid JWT token')
  const result = await createEnrichedJwt(payload.sub, payload.license_nonce, JWT_CONFIG.ttlSeconds)
  if (!result) throw new Error('Failed to refresh JWT')
  return result.token
}
