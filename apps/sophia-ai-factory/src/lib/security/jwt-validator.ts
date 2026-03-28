/**
 * JWT Validator for RaaS Gateway Audit API
 *
 * Handles JWT verification using Supabase JWKS endpoint.
 * Supports Authorization: Bearer <token> header format.
 *
 * @module security/jwt-validator
 */

import { jwtVerify, createRemoteJWKSet } from 'jose'
import { logger } from '@/lib/utils/logger-utility'
import { checkJwtNonce, markJwtNonceAsUsed } from '@/lib/auth/jwt-nonce-tracker'
import type { EnrichedJwtPayload } from '@/lib/auth/enriched-jwt'

// Re-export enriched types for convenience
export type { EnrichedJwtPayload as EnrichedJwtClaims } from '@/lib/auth/enriched-jwt'

/**
 * JWT payload structure (basic)
 */
export interface JwtPayload {
  sub: string // user_id
  iat: number // issued at (seconds)
  exp: number // expiration (seconds)
  permissions?: string[] // optional permissions array
  aud?: string // audience
  iss?: string // issuer
}

/**
 * Extended JWT payload with enriched claims (Phase 2)
 */
export interface ExtendedJwtPayload extends JwtPayload {
  // RaaS License claims
  license_nonce?: string
  license_tier?: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'
  license_issued_at?: number
  license_expires_at?: number

  // Quota claims
  quota?: {
    tier: string
    dailyCredits: number
    hourlyCredits: number
    dailyRequests: number
    monthlyCredits: number
  }

  // Tenant isolation
  agency_id?: string

  // Polar billing context
  polar_customer_id?: string
  polar_subscription_id?: string
  polar_subscription_status?: string
  billing_status?: 'active' | 'past_due' | 'suspended'
  is_paid?: boolean
  overage_allowed?: boolean

  // Dunning state
  dunning_state?: 'ok' | 'grace_period' | 'suspended' | 'delinquent'

  // Feature entitlements (Phase 2)
  feature_entitlements?: string[]
  feature_limits?: Record<string, {
    daily_limit?: number
    monthly_limit?: number
    max_tokens?: number
  }>
}

/**
 * JWT validation result
 */
export interface JwtValidationResult {
  valid: boolean
  error?: 'missing-token' | 'invalid-format' | 'expired' | 'invalid-signature' | 'invalid-issuer'
  payload?: JwtPayload | ExtendedJwtPayload
}

/**
 * Check if payload is enriched (Phase 2)
 */
export function isEnrichedPayload(
  payload: JwtPayload | ExtendedJwtPayload
): payload is ExtendedJwtPayload {
  return 'license_nonce' in payload || 'feature_entitlements' in payload
}

/**
 * Extract enriched claims from validated JWT
 * Returns null if JWT is not enriched or invalid
 */
export function extractEnrichedClaims(
  payload: JwtPayload | ExtendedJwtPayload
): EnrichedJwtPayload | null {
  if (!isEnrichedPayload(payload)) {
    return null
  }

  // Check required enriched claims
  if (!payload.license_nonce || !payload.feature_entitlements) {
    logger.warn('[JWT Validator] JWT missing enriched claims')
    return null
  }

  return {
    sub: payload.sub,
    iat: payload.iat,
    exp: payload.exp,
    jti: (payload as any).jti,
    agency_id: payload.agency_id || '',
    license_nonce: payload.license_nonce,
    license_tier: payload.license_tier || 'BASIC',
    feature_entitlements: payload.feature_entitlements,
    feature_limits: payload.feature_limits || {},
    polar_customer_id: payload.polar_customer_id,
    polar_subscription_id: payload.polar_subscription_id,
    billing_status: payload.billing_status,
    is_paid: payload.is_paid,
    overage_allowed: payload.overage_allowed,
    quota_remaining: payload.quota ? {
      dailyCredits: payload.quota.dailyCredits,
      hourlyCredits: payload.quota.hourlyCredits,
      monthlyCredits: payload.quota.monthlyCredits,
    } : undefined,
  } as EnrichedJwtPayload
}

/**
 * JWT header format: Authorization: Bearer <token>
 */
const BEARER_PREFIX = 'Bearer '

/**
 * Get Supabase URL for JWKS endpoint
 */
function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable not set')
  }
  return url
}

/**
 * Get JWKS URI from Supabase URL
 * Supabase exposes JWKS at: {url}/auth/v1/jwks
 */
function getJwksUri(): string {
  const baseUrl = getSupabaseUrl()
  return `${baseUrl}/auth/v1/jwks`
}

/**
 * Get expected issuer for JWT validation
 */
function getExpectedIssuer(): string {
  const baseUrl = getSupabaseUrl()
  return `${baseUrl}/auth/v1`
}

/**
 * Cached JWK Set for performance
 * jose library handles rotation automatically
 */
let jwkSet: ReturnType<typeof createRemoteJWKSet> | null = null

/**
 * Get or create JWKS cache
 */
function getJwkSet() {
  if (!jwkSet) {
    const jwksUri = getJwksUri()
    jwkSet = createRemoteJWKSet(new URL(jwksUri), {
      cooldownDuration: 60000, // 1 minute cooldown between fetches
    })
  }
  return jwkSet
}

/**
 * Decode JWT without verification (for logging/debugging)
 * Warning: Does not verify signature - use validateJwt for security
 *
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid format
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8')
    const payload = JSON.parse(payloadStr) as JwtPayload

    return payload
  } catch {
    return null
  }
}

/**
 * Validate JWT from Authorization header
 *
 * Verifies:
 * 1. Token format (Bearer <token>)
 * 2. Signature using Supabase JWKS
 * 3. Expiration (exp claim)
 * 4. Issuer (iss claim matches Supabase URL)
 *
 * @param authHeader - Authorization header value
 * @returns Validation result with payload if valid
 */
export async function validateJwt(
  authHeader: string | null
): Promise<JwtValidationResult> {
  // Check for missing header
  if (!authHeader) {
    return {
      valid: false,
      error: 'missing-token',
    }
  }

  // Check Bearer format
  if (!authHeader.startsWith(BEARER_PREFIX)) {
    return {
      valid: false,
      error: 'invalid-format',
    }
  }

  const token = authHeader.slice(BEARER_PREFIX.length)

  // Check token is not empty
  if (!token || token.length < 50) {
    return {
      valid: false,
      error: 'invalid-format',
    }
  }

  try {
    // Verify JWT using Supabase JWKS
    const jwks = getJwkSet()
    const expectedIss = getExpectedIssuer()

    const { payload, protectedHeader } = await jwtVerify(token, jwks, {
      issuer: expectedIss,
      audience: ['authenticated', 'supabase'],
      clockTolerance: 60, // 60 second tolerance for clock skew
    })

    // Extract typed payload (basic claims)
    const jwtPayload: ExtendedJwtPayload = {
      sub: (payload.sub as string) || 'unknown',
      iat: payload.iat || 0,
      exp: payload.exp || 0,
      permissions: (payload as any).permissions,
      aud: Array.isArray(payload.aud) ? payload.aud[0] : (payload.aud || undefined),
      iss: payload.iss || undefined,
      // Enriched claims (Phase 2)
      license_nonce: (payload as any).license_nonce,
      license_tier: (payload as any).license_tier as ExtendedJwtPayload['license_tier'],
      license_issued_at: (payload as any).license_issued_at,
      license_expires_at: (payload as any).license_expires_at,
      quota: (payload as any).quota,
      agency_id: (payload as any).agency_id,
      polar_customer_id: (payload as any).polar_customer_id,
      polar_subscription_id: (payload as any).polar_subscription_id,
      polar_subscription_status: (payload as any).polar_subscription_status,
      billing_status: (payload as any).billing_status,
      is_paid: (payload as any).is_paid,
      overage_allowed: (payload as any).overage_allowed,
      dunning_state: (payload as any).dunning_state,
      feature_entitlements: (payload as any).feature_entitlements,
      feature_limits: (payload as any).feature_limits,
    }

    // NEW: Check nonce for replay prevention (if jti claim exists)
    const jti = payload.jti as string | undefined
    if (jti) {
      const nonceCheck = await checkJwtNonce(jti)
      if (!nonceCheck.valid) {
        logger.warn('[JWT Validator] Nonce check failed', {
          reason: nonceCheck.reason,
          jti: jti.slice(0, 8) + '...',
        })
        return {
          valid: false,
          error: 'invalid-signature', // Treat replay as signature failure
        }
      }

      // Mark nonce as used after successful validation
      await markJwtNonceAsUsed(jti, jwtPayload.sub, jwtPayload.exp)
    }

    logger.info('[JWT Validator] JWT verified successfully', {
      userId: jwtPayload.sub,
      expiresAt: new Date(jwtPayload.exp * 1000).toISOString(),
    })

    return {
      valid: true,
      payload: jwtPayload,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Determine error type based on message
    if (errorMessage.includes('expired')) {
      logger.warn('[JWT Validator] JWT expired', { error: errorMessage })
      return {
        valid: false,
        error: 'expired',
      }
    }

    if (errorMessage.includes('issuer') || errorMessage.includes('audience')) {
      logger.warn('[JWT Validator] JWT issuer/audience mismatch', { error: errorMessage })
      return {
        valid: false,
        error: 'invalid-issuer',
      }
    }

    // Default to invalid signature for other errors
    logger.warn('[JWT Validator] JWT signature verification failed', { error: errorMessage })
    return {
      valid: false,
      error: 'invalid-signature',
    }
  }
}

/**
 * Check if JWT is expired (without full verification)
 * Useful for quick pre-checks
 *
 * @param token - JWT token string
 * @returns true if token is expired or invalid
 */
export function isJwtExpired(token: string): boolean {
  const payload = decodeJwt(token)
  if (!payload) {
    return true
  }

  const now = Math.floor(Date.now() / 1000)
  return payload.exp < now
}

/**
 * Extract user ID from valid JWT
 *
 * @param authHeader - Authorization header
 * @returns User ID or null if invalid
 */
export async function extractUserIdFromJwt(
  authHeader: string | null
): Promise<string | null> {
  const result = await validateJwt(authHeader)
  return result.valid ? result.payload?.sub || null : null
}
