/**
 * License validation and feature access check for RaaS Auth Middleware
 * @module worker/middleware/raas-auth-middleware-validators
 */

/// <reference types="@cloudflare/workers-types" />

import { validateApiKey } from '@/seed/security/api-key-validator'
import { validateJwt, extractEnrichedClaims } from '@/seed/security/jwt-validator'
import { logger } from '@/seed/utils/logger-utility'
import { getLicenseContext, extractApiKey as extractApiKeyHeader, extractJwt } from './raas-auth-middleware-kv'
import type { AuthContext, FeatureCheckResult } from './raas-auth-middleware-types'

export async function validateLicense(
  request: Request,
  env: Env,
): Promise<{ valid: boolean; context?: AuthContext; error?: string }> {
  const apiKey = extractApiKeyHeader(request)
  const jwtToken = extractJwt(request)

  if (!apiKey && !jwtToken) {
    return { valid: false, error: 'Authentication required: provide X-API-Key or Authorization header' }
  }

  if (apiKey) {
    try {
      const result = await validateApiKey(apiKey)
      if (!result.valid) return { valid: false, error: `Invalid API key: ${result.error}` }

      const licenseContext = await getLicenseContext(result.apiKey!.ownerId, (env as unknown as { KV_KV: KVNamespace }).KV_KV)
      if (!licenseContext) return { valid: false, error: 'License not found' }

      return {
        valid: true,
        context: {
          userId: result.apiKey!.ownerId,
          licenseNonce: result.apiKey!.ownerId,
          tier: licenseContext.tier,
          featureEntitlements: licenseContext.featureEntitlements,
          agencyId: licenseContext.agencyId,
        },
      }
    } catch (error) {
      logger.error('[RaaS Auth Middleware] API key validation failed', error instanceof Error ? error : new Error(String(error)))
      return { valid: false, error: 'API key validation failed' }
    }
  }

  if (jwtToken) {
    try {
      const result = await validateJwt(jwtToken)
      if (!result.valid) return { valid: false, error: `Invalid JWT: ${result.error}` }

      const enrichedClaims = extractEnrichedClaims(result.payload!)
      if (!enrichedClaims) return { valid: false, error: 'JWT missing enriched claims' }

      return {
        valid: true,
        context: {
          userId: enrichedClaims.sub,
          licenseNonce: enrichedClaims.license_nonce,
          tier: enrichedClaims.license_tier,
          featureEntitlements: enrichedClaims.feature_entitlements,
          agencyId: enrichedClaims.agency_id,
          isPaid: enrichedClaims.is_paid,
        },
      }
    } catch (error) {
      logger.error('[RaaS Auth Middleware] JWT validation failed', error instanceof Error ? error : new Error(String(error)))
      return { valid: false, error: 'JWT validation failed' }
    }
  }

  return { valid: false, error: 'No valid authentication method' }
}

export async function checkFeatureAccess(featureKey: string, authContext: AuthContext): Promise<FeatureCheckResult> {
  const hasEntitlement = authContext.featureEntitlements.includes(featureKey)
  if (!hasEntitlement) return { allowed: false, reason: 'not_entitled', featureKey }

  return { allowed: true, featureKey }
}
