/**
 * JWT Validator for RaaS Gateway Audit API
 * @module security/jwt-validator
 */

import { jwtVerify } from 'jose'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'
import { checkJwtNonce, markJwtNonceAsUsed } from '@/lib/auth/jwt-nonce-tracker'
import { BEARER_PREFIX, getJwkSet, getExpectedIssuer } from './jwt-validator-jwks'
import type { ExtendedJwtPayload, JwtValidationResult } from './jwt-validator-types'

export type { JwtPayload, ExtendedJwtPayload, JwtValidationResult, EnrichedJwtClaims } from './jwt-validator-types'
export { isEnrichedPayload, extractEnrichedClaims } from './jwt-validator-types'
export { decodeJwt, isJwtExpired } from './jwt-validator-jwks'

export async function validateJwt(authHeader: string | null): Promise<JwtValidationResult> {
  if (!authHeader) return { valid: false, error: 'missing-token' }
  if (!authHeader.startsWith(BEARER_PREFIX)) return { valid: false, error: 'invalid-format' }
  const token = authHeader.slice(BEARER_PREFIX.length)
  if (!token || token.length < 50) return { valid: false, error: 'invalid-format' }

  try {
    const jwks = getJwkSet()
    const { payload } = await jwtVerify(token, jwks, {
      issuer: getExpectedIssuer(),
      audience: ['authenticated', 'supabase'],
      clockTolerance: 60,
    })

    const claims = payload as Partial<ExtendedJwtPayload>
    const jwtPayload: ExtendedJwtPayload = {
      sub: (payload.sub as string) || 'unknown', iat: payload.iat || 0, exp: payload.exp || 0,
      permissions: claims.permissions,
      aud: Array.isArray(payload.aud) ? payload.aud[0] : (payload.aud || undefined),
      iss: payload.iss || undefined,
      license_nonce: claims.license_nonce, license_tier: claims.license_tier,
      license_issued_at: claims.license_issued_at, license_expires_at: claims.license_expires_at,
      quota: claims.quota, agency_id: claims.agency_id,
      polar_customer_id: claims.polar_customer_id, polar_subscription_id: claims.polar_subscription_id,
      polar_subscription_status: claims.polar_subscription_status, billing_status: claims.billing_status,
      is_paid: claims.is_paid, overage_allowed: claims.overage_allowed, dunning_state: claims.dunning_state,
      feature_entitlements: claims.feature_entitlements, feature_limits: claims.feature_limits,
    }

    const jti = payload.jti as string | undefined
    if (jti) {
      const nonceCheck = await checkJwtNonce(jti)
      if (!nonceCheck.valid) {
        logger.warn('[JWT Validator] Nonce check failed', { reason: nonceCheck.reason, jti: jti.slice(0, 8) + '...' })
        return { valid: false, error: 'invalid-signature' }
      }
      await markJwtNonceAsUsed(jti, jwtPayload.sub, jwtPayload.exp)
    }

    logger.info('[JWT Validator] JWT verified successfully', { userId: jwtPayload.sub, expiresAt: new Date(jwtPayload.exp * 1000).toISOString() })
    return { valid: true, payload: jwtPayload }
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    if (errorMessage.includes('expired')) {
      logger.warn('[JWT Validator] JWT expired', { error: errorMessage })
      return { valid: false, error: 'expired' }
    }
    if (errorMessage.includes('issuer') || errorMessage.includes('audience')) {
      logger.warn('[JWT Validator] JWT issuer/audience mismatch', { error: errorMessage })
      return { valid: false, error: 'invalid-issuer' }
    }
    logger.warn('[JWT Validator] JWT signature verification failed', { error: errorMessage })
    return { valid: false, error: 'invalid-signature' }
  }
}

export async function extractUserIdFromJwt(authHeader: string | null): Promise<string | null> {
  const result = await validateJwt(authHeader)
  return result.valid ? result.payload?.sub || null : null
}
