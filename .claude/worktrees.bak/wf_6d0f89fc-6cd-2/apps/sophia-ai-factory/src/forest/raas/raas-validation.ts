/**
 * RaaS Validation - License key extraction and format validation
 *
 * Handles key extraction from requests and V1 legacy format validation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import { validateLicenseKey as validateWithHmac, ValidationResult } from '@/forest/raas-service'

/**
 * RaaS validation result (legacy interface for backward compatibility)
 */
export interface RaaSValidationResult {
  valid: boolean
  reason?: string
  tier?: string
}

/**
 * Validate V1 format keys (backward compatibility)
 * Format: raas_{tier}_{encrypted_payload}
 */
function validateV1Format(key: string): RaaSValidationResult {
  const keyPattern = /^raas_(basic|premium|enterprise|master)_[a-zA-Z0-9]+$/
  const match = key.match(keyPattern)

  if (!match) return { valid: false, reason: 'invalid-format' }

  const tier = match[1]
  logger.info('[RaaS Gate] V1 format key validated (legacy)', { tier })
  return { valid: true, tier }
}

/**
 * Extract RaaS license key from request headers
 *
 * Priority:
 * 1. X-RaaS-License-Key header
 * 2. Authorization header (Bearer raas_...)
 * 3. Query parameter (license_key) — less secure, for webhook testing
 */
export function extractLicenseKey(request: NextRequest): string | null {
  const headerKey = request.headers.get('x-raas-license-key')
  if (headerKey) return headerKey

  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (token.startsWith('raas_')) return token
  }

  const queryKey = request.nextUrl.searchParams.get('license_key')
  if (queryKey) {
    logger.warn('[RaaS Gate] License key from query param - insecure')
    return queryKey
  }

  return null
}

/**
 * Decrypt and validate RaaS license key
 *
 * Validation flow:
 * 1. Check development bypass (RAAS_BYPASS_DEV)
 * 2. Check V1 format fallback (if RAAS_V1_FORMAT=true)
 * 3. Call raas-service.validateLicenseKey() with HMAC validation
 */
export async function validateLicenseKey(key: string | null): Promise<RaaSValidationResult> {
  const bypassDev = process.env.RAAS_BYPASS_DEV === 'true'
  const isDev = process.env.NODE_ENV === 'development'

  if (isDev && bypassDev) {
    logger.info('[RaaS Gate] Development bypass enabled')
    return { valid: true, reason: 'dev-bypass' }
  }

  if (!key || key.length === 0) return { valid: false, reason: 'missing-key' }

  if (process.env.RAAS_V1_FORMAT === 'true') {
    const parts = key.split('_')
    if (parts.length === 3) {
      logger.info('[RaaS Gate] V1 format detected, using legacy validation')
      return validateV1Format(key)
    }
  }

  if (!process.env.RAAS_LICENSE_SECRET && isDev === false) {
    logger.error('[RaaS Gate] RAAS_LICENSE_SECRET not configured in production')
    return { valid: false, reason: 'config-error' }
  }

  try {
    const result: ValidationResult = await validateWithHmac(key)
    return { valid: result.valid, reason: result.reason, tier: result.tier }
  } catch (error) {
    logger.error('[RaaS Gate] Validation error', error instanceof Error ? error : new Error(String(error)))
    return { valid: false, reason: 'validation-error' }
  }
}

/**
 * Create standardized 403 error response
 */
export function createForbiddenResponse(reason: string): NextResponse {
  const errorMessages: Record<string, string> = {
    'missing-key': 'RaaS license key is required. Include X-RaaS-License-Key header or Bearer token.',
    'invalid-format': 'Invalid RaaS license key format. Expected: raas_{tier}_{payload}',
    'expired': 'RaaS license key has expired',
    'invalid-signature': 'RaaS license key signature verification failed',
  }

  return NextResponse.json(
    {
      error: 'Forbidden',
      message: errorMessages[reason] || 'Access denied',
      code: 'RAAS_FORBIDDEN',
      reason,
    },
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-RaaS-Reason': reason,
      },
    }
  )
}

/**
 * Check if RaaS gate should be applied to this route
 *
 * Excluded routes (public access):
 * - /api/health - Health checks
 * - /api/setup/* - Initial setup wizard
 * - /api/webhooks/nowpayments - NOWPayments IPN webhooks
 * - /api/webhooks/telegram - Telegram webhooks
 */
export function shouldApplyRaasGate(pathname: string): boolean {
  const publicRoutes = [
    '/api/health',
    '/api/setup',
    '/api/webhooks/nowpayments',
    '/api/webhooks/telegram',
    '/api/auth',
    '/api/discovery',
    '/api/sophia-index',
  ]
  return !publicRoutes.some(route => pathname.startsWith(route))
}

/**
 * Get current RaaS configuration status
 */
export function getRaaSConfig(): {
  enabled: boolean
  bypassDev: boolean
  isDev: boolean
  hasSecret: boolean
  v1Format: boolean
} {
  const isDev = process.env.NODE_ENV === 'development'
  const bypassDev = process.env.RAAS_BYPASS_DEV === 'true'
  const hasLicenseKey = !!process.env.RAAS_LICENSE_KEY
  const hasSecret = !!process.env.RAAS_LICENSE_SECRET
  const v1Format = process.env.RAAS_V1_FORMAT === 'true'

  return { enabled: hasLicenseKey || !bypassDev, bypassDev, isDev, hasSecret, v1Format }
}
