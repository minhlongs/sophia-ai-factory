/**
 * JWT Claims Enrichment Service
 *
 * Issues JWTs with embedded license metadata for fast Cloudflare Worker enforcement.
 *
 * Sub-modules:
 *   enriched-jwt-types.ts        — FeatureLimit, EnrichedJwtPayload, LicenseContext
 *   enriched-jwt-entitlements.ts — getDefaultEntitlements, getFeatureLimits
 *   enriched-jwt-billing.ts      — getLicenseContext, fetchDunningState
 *
 * @module auth/enriched-jwt
 */

import { SignJWT, jwtVerify } from 'jose'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { QuotaLimit } from '@/seed/types/quota-limit'
import type { QuotaProvider } from '@/seed/types/quota-provider'

export type { FeatureLimit, EnrichedJwtPayload, EnrichedJwtClaims, LicenseContext } from './enriched-jwt-types'
export { getDefaultEntitlements } from './enriched-jwt-entitlements'
export { getLicenseContext } from './enriched-jwt-billing'

import type { EnrichedJwtPayload } from '@/seed/auth/enriched-jwt-types'
import { getDefaultEntitlements, getFeatureLimits } from '@/seed/auth/enriched-jwt-entitlements'
import { getLicenseContext, fetchDunningState } from '@/seed/auth/enriched-jwt-billing'

const EMPTY_QUOTA: QuotaLimit = {
  tier: 'unknown', dailyCredits: 0, hourlyCredits: 0, dailyRequests: 0, monthlyCredits: 0,
}

const JWT_CONFIG = { algorithm: 'HS256' as const, ttlSeconds: 3600 }

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET=REDACTED
  if (!secret) {
    throw new Error('[Enriched JWT] JWT_SECRET=REDACTED is required — refusing to start with insecure default')
  }
  return new TextEncoder().encode(secret)
}

export async function createEnrichedJwt(
  userId: string,
  licenseNonce: string,
  ttlSeconds: number = JWT_CONFIG.ttlSeconds,
  quotaProvider?: QuotaProvider,
): Promise<{ token: string; payload: EnrichedJwtPayload } | null> {
  try {
    const licenseContext = await getLicenseContext(licenseNonce)
    if (!licenseContext) return null

    let quota: QuotaLimit
    if (quotaProvider) {
      quota = await quotaProvider.getEffectiveQuotaLimits(licenseNonce, licenseContext.tier)
    } else {
      // DI fallback: emit a default-DENY EMPTY_QUOTA (0 credits across all dimensions)
      // when caller did not inject a provider. Downstream `quota.dailyCredits > 0`
      // checks fail safely, enforcing the paywall. DO NOT raise these defaults —
      // doing so would silently bypass tier limits (default-ALLOW security regression).
      // This branch SHOULD NOT execute in production; the warn log surfaces missed
      // injections in observability for triage.
      logger.warn('[Enriched JWT] quotaProvider not injected — emitting EMPTY_QUOTA (caller must inject in production)', {
        userId, licenseNonce: licenseNonce.slice(0, 8) + '...',
      })
      quota = { ...EMPTY_QUOTA, tier: licenseContext.tier }
    }
    const dunningState = await fetchDunningState(licenseNonce)
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
      billing_status: 'active' as const,
      is_paid: true,
      overage_allowed: false,
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

export async function refreshJwtIfExpired(token: string, quotaProvider?: QuotaProvider): Promise<string> {
  if (!isJwtExpired(token)) return token
  const payload = decodeEnrichedJwt(token)
  if (!payload) throw new Error('Invalid JWT token')
  const result = await createEnrichedJwt(payload.sub, payload.license_nonce, JWT_CONFIG.ttlSeconds, quotaProvider)
  if (!result) throw new Error('Failed to refresh JWT')
  return result.token
}
