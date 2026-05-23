/**
 * Types and claim extraction for JWT Validator
 * @module security/jwt-validator-types
 */

import { logger } from '@/seed/utils/logger-utility'
import type { EnrichedJwtPayload } from '@/seed/auth/enriched-jwt'

export type { EnrichedJwtPayload as EnrichedJwtClaims } from '@/seed/auth/enriched-jwt'

export interface JwtPayload {
  sub: string
  iat: number
  exp: number
  permissions?: string[]
  aud?: string
  iss?: string
}

export interface ExtendedJwtPayload extends JwtPayload {
  license_nonce?: string
  license_tier?: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'
  license_issued_at?: number
  license_expires_at?: number
  quota?: { tier: string; dailyCredits: number; hourlyCredits: number; dailyRequests: number; monthlyCredits: number }
  agency_id?: string
  billing_status?: 'active' | 'past_due' | 'suspended'
  is_paid?: boolean
  overage_allowed?: boolean
  dunning_state?: 'ok' | 'grace_period' | 'suspended' | 'delinquent'
  feature_entitlements?: string[]
  feature_limits?: Record<string, { daily_limit?: number; monthly_limit?: number; max_tokens?: number }>
}

export interface JwtValidationResult {
  valid: boolean
  error?: 'missing-token' | 'invalid-format' | 'expired' | 'invalid-signature' | 'invalid-issuer'
  payload?: JwtPayload | ExtendedJwtPayload
}

export function isEnrichedPayload(payload: JwtPayload | ExtendedJwtPayload): payload is ExtendedJwtPayload {
  return 'license_nonce' in payload || 'feature_entitlements' in payload
}

export function extractEnrichedClaims(payload: JwtPayload | ExtendedJwtPayload): EnrichedJwtPayload | null {
  if (!isEnrichedPayload(payload)) return null
  if (!payload.license_nonce || !payload.feature_entitlements) {
    logger.warn('[JWT Validator] JWT missing enriched claims')
    return null
  }
  return {
    sub: payload.sub, iat: payload.iat, exp: payload.exp,
    jti: (payload as { jti?: string }).jti,
    agency_id: payload.agency_id || '',
    license_nonce: payload.license_nonce,
    license_tier: payload.license_tier || 'BASIC',
    feature_entitlements: payload.feature_entitlements,
    feature_limits: payload.feature_limits || {},
    billing_status: payload.billing_status,
    is_paid: payload.is_paid,
    overage_allowed: payload.overage_allowed,
    quota_remaining: payload.quota ? { dailyCredits: payload.quota.dailyCredits, hourlyCredits: payload.quota.hourlyCredits, monthlyCredits: payload.quota.monthlyCredits } : undefined,
  } as unknown as EnrichedJwtPayload
}
