/**
 * RaaS (ROI-as-a-Service) License Gate Middleware
 *
 * Validates encrypted RaaS_LICENSE_KEY on all /api/* routes
 * Blocks access if invalid or missing, returns standardized 403 errors
 *
 * Features:
 * - HMAC-SHA256 signature validation via raas-service.ts
 * - Development bypass with RAAS_BYPASS_DEV=true
 * - Production mode enforcement
 * - Redis nonce/revocation tracking
 * - Backward compatibility: RAAS_V1_FORMAT=true fallback
 * - Logging of validation attempts
 * - Standardized error responses
 * - Quota enforcement with overage billing (Phase 6)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from './utils/logger-utility';
import { validateLicenseKey as validateWithHmac, ValidationResult } from './raas-service';
import { logValidationWithReceipt, serializeReceiptForHeader } from './audit/audit-logger';
import { checkQuotaWithOverage, DEFAULT_CONFIG } from './quota/quota-checker';
import { enforceQuota } from './quota/quota-enforcer';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasEmergencyBypass, recordCircuitFailure, recordCircuitSuccess } from './usage-metering/realtime-tracker';
import { checkPolarSubscriptionStatus } from './billing/polar-metered-billing';
import { logViolationAndAlert } from '@/lib/alerts/realtime-alert-service';
import { sha256 } from '@/lib/audit/crypto-utils';
import type { RaasLicenseRow } from '@/lib/supabase/types';

/**
 * RaaS validation result (legacy interface for backward compatibility)
 */
interface RaaSValidationResult {
  valid: boolean;
  reason?: string;
  tier?: string;
}

/**
 * Validate V1 format keys (backward compatibility mode)
 * Format: raas_{tier}_{encrypted_payload}
 *
 * @param key - V1 format key
 * @returns Validation result
 */
function validateV1Format(key: string): RaaSValidationResult {
  const keyPattern = /^raas_(basic|premium|enterprise|master)_[a-zA-Z0-9]+$/;
  const match = key.match(keyPattern);

  if (!match) {
    return { valid: false, reason: 'invalid-format' };
  }

  const tier = match[1];
  logger.info('[RaaS Gate] V1 format key validated (legacy)', { tier });

  return { valid: true, tier };
}

/**
 * Decrypt and validate RaaS license key
 *
 * Validation flow:
 * 1. Check development bypass (RAAS_BYPASS_DEV)
 * 2. Check V1 format fallback (if RAAS_V1_FORMAT=true)
 * 3. Call raas-service.validateLicenseKey() with HMAC validation
 * 4. Check RAAS_LICENSE_SECRET is configured in production
 * 5. Return result with tier info
 *
 * @param key - License key string or null
 * @returns Validation result
 */
async function validateLicenseKey(key: string | null): Promise<RaaSValidationResult> {
  // Check for development bypass
  const bypassDev = process.env.RAAS_BYPASS_DEV === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev && bypassDev) {
    logger.info('[RaaS Gate] Development bypass enabled');
    return { valid: true, reason: 'dev-bypass' };
  }

  // Check if key exists
  if (!key || key.length === 0) {
    return { valid: false, reason: 'missing-key' };
  }

  // Check V1 format fallback (backward compatibility)
  if (process.env.RAAS_V1_FORMAT === 'true') {
    const parts = key.split('_');
    if (parts.length === 3) {
      logger.info('[RaaS Gate] V1 format detected, using legacy validation');
      return validateV1Format(key);
    }
  }

  // Validate RAAS_LICENSE_SECRET is configured in production
  if (!process.env.RAAS_LICENSE_SECRET && isDev === false) {
    logger.error('[RaaS Gate] RAAS_LICENSE_SECRET not configured in production');
    return { valid: false, reason: 'config-error' };
  }

  // Use raas-service for HMAC validation
  try {
    const result: ValidationResult = await validateWithHmac(key);

    return {
      valid: result.valid,
      reason: result.reason,
      tier: result.tier,
    };
  } catch (error) {
    logger.error('[RaaS Gate] Validation error', error instanceof Error ? error : new Error(String(error)));
    return { valid: false, reason: 'validation-error' };
  }
}

/**
 * Extract RaaS license key from request headers
 *
 * Priority:
 * 1. X-RaaS-License-Key header
 * 2. Authorization header (Bearer raas_...)
 * 3. Query parameter (license_key) - less secure, for webhook testing
 */
function extractLicenseKey(request: NextRequest): string | null {
  // Check custom header
  const headerKey = request.headers.get('x-raas-license-key');
  if (headerKey) {
    return headerKey;
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.startsWith('raas_')) {
      return token;
    }
  }

  // Check query parameter (for webhook testing only)
  const queryKey = request.nextUrl.searchParams.get('license_key');
  if (queryKey) {
    logger.warn('[RaaS Gate] License key from query param - insecure');
    return queryKey;
  }

  return null;
}

/**
 * Create standardized 403 error response
 */
function createForbiddenResponse(reason: string): NextResponse {
  const errorMessages: Record<string, string> = {
    'missing-key': 'RaaS license key is required. Include X-RaaS-License-Key header or Bearer token.',
    'invalid-format': 'Invalid RaaS license key format. Expected: raas_{tier}_{payload}',
    'expired': 'RaaS license key has expired',
    'invalid-signature': 'RaaS license key signature verification failed',
  };

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
  );
}

/**
 * RaaS Gate Middleware
 *
 * Use in proxy.ts for /api/* routes or in individual API route handlers
 *
 * @param request - Next.js request object
 * @returns Validation result with optional response and receipt
 */
export async function raasGate(request: NextRequest): Promise<{
  valid: boolean;
  response?: NextResponse;
  tier?: string;
  receipt?: string;
  quotaWarning?: boolean;
  quotaExceeded?: boolean;
  quotaRemaining?: {
    dailyCredits: number;
    hourlyCredits: number;
    dailyRequests: number;
    monthlyCredits: number;
  };
}> {
  const licenseKey = extractLicenseKey(request);
  const result = await validateLicenseKey(licenseKey);

  if (!result.valid) {
    // Log failed validation attempt with receipt
    await logValidationWithReceipt({
      nonce: licenseKey || 'unknown',
      isValid: false,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      tier: 'unknown'
    });

    logger.info('[RaaS Gate] Validation attempt', {
      path: request.nextUrl.pathname,
      valid: result.valid,
      reason: result.reason,
    });

    return {
      valid: false,
      response: createForbiddenResponse(result.reason!),
    };
  }

  // Log successful validation with receipt
  const receipt = await logValidationWithReceipt({
    nonce: licenseKey!,
    isValid: true,
    userId: request.headers.get('x-logged-in-user-id') || undefined,
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    tier: result.tier
  });

  logger.info('[RaaS Gate] Validation attempt', {
    path: request.nextUrl.pathname,
    valid: result.valid,
    reason: result.reason,
    hasReceipt: !!receipt
  });

  // QUOTA ENFORCEMENT (Phase 2): Real-time quota check with circuit breaker
  if (result.valid && licenseKey) {
    let licenseNonceForError: string | undefined;

    try {
      const supabase = createAdminClient();

      // Get license info from DB
      // Note: Using type assertion for Supabase query result since generated types
      // may not be available. The query returns RaasLicenseRow format.
      const keyHash = sha256(licenseKey);
      const { data: license } = await supabase
        .from('raas_licenses')
        .select('nonce, tier, polar_customer_id')
        .eq('key_hash', keyHash)
        .single();

      if (license) {
        licenseNonceForError = license.nonce;

        // Get user ID from license owner
        const { data: licenseData } = await supabase
          .from('raas_licenses')
          .select('created_by')
          .eq('nonce', license.nonce)
          .single();

        const userId = licenseData?.created_by || 'anonymous';
        const tier = (license.tier || 'BASIC').toUpperCase();
        const polarCustomerId = license.polar_customer_id;

        // POLAR SUBSCRIPTION CHECK (Phase 1 Critical Fix)
        // Check Polar subscription status before allowing requests
        if (polarCustomerId) {
          try {
            const polarStatus = await checkPolarSubscriptionStatus(polarCustomerId);

            // Block if subscription is not active (except for 'none' tier - legacy users)
            if (!polarStatus.active && polarStatus.subscriptionTier !== 'none') {
              logger.warn('[RaaS Gate] Polar subscription not active', {
                userId,
                licenseNonce: license.nonce.slice(0, 8) + '...',
                polarCustomerId,
                subscriptionTier: polarStatus.subscriptionTier,
                balance: polarStatus.balance,
              });

              return {
                valid: false,
                response: NextResponse.json(
                  {
                    error: 'subscription_inactive',
                    code: 'SUBSCRIPTION_INACTIVE',
                    message: 'Your subscription is not active. Please update your billing information.',
                    subscriptionTier: polarStatus.subscriptionTier,
                    currentPeriodEnd: polarStatus.currentPeriodEnd,
                    upgradeUrl: '/dashboard/billing',
                  },
                  {
                    status: 403,
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  }
                ),
                tier: result.tier,
              };
            }

            // Log subscription status for audit
            logger.debug('[RaaS Gate] Polar subscription check passed', {
              userId,
              polarCustomerId,
              active: polarStatus.active,
              balance: polarStatus.balance,
              tier: polarStatus.subscriptionTier,
            });
          } catch (polarError) {
            logger.error('[RaaS Gate] Polar subscription check failed', polarError instanceof Error ? polarError : new Error(String(polarError)));
            // Don't block on Polar API error - fail open with warning
            logger.warn('[RaaS Gate] Failing open - allowing request despite Polar check failure');
          }
        }

        // Check emergency bypass (admin override)
        if (hasEmergencyBypass(request.headers)) {
          logger.warn('[RaaS Gate] Emergency bypass activated', {
            userId,
            licenseNonce: license.nonce.slice(0, 8) + '...',
            path: request.nextUrl.pathname,
          });

          return {
            valid: true,
            tier: result.tier,
            receipt: receipt ? serializeReceiptForHeader(receipt) : undefined,
            quotaWarning: false,
          };
        }

        // Enforce quota with circuit breaker protection
        const quotaResult = await enforceQuota({
          userId,
          licenseNonce: license.nonce,
          tier,
          requestedCredits: 1,
          endpoint: request.nextUrl.pathname,
          ipAddress: request.headers.get('x-forwarded-for') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
          polarCustomerId: license.polar_customer_id || undefined,
        }, DEFAULT_CONFIG);

        // Hard block if quota exceeded (fail-closed)
        if (!quotaResult.allowed) {
          // Record circuit success (blocking is expected behavior)
          await recordCircuitSuccess(license.nonce);

          // Phase 7.3: Log violation and create real-time alert
          await logViolationAndAlert({
            userId,
            licenseNonce: license.nonce,
            tier: tier as any,
            type: 'quota_exceeded',
            severity: quotaResult.result.exceeded?.type === 'hourly_credits' ? 'critical' : 'high',
            endpoint: request.nextUrl.pathname,
            ipAddress: request.headers.get('x-forwarded-for') || undefined,
            userAgent: request.headers.get('user-agent') || undefined,
            metadata: {
              exceeded: quotaResult.result.exceeded,
              remaining: quotaResult.result.remaining,
              retryAfter: quotaResult.response?.retryAfter,
            },
          }).catch(err => {
            logger.error('[RaaS Gate] Failed to log violation and alert', err as Error);
          });

          // Convert quota response to 429 with standardized headers
          const quotaResponse = quotaResult.response;
          return {
            valid: false,
            response: NextResponse.json(
              {
                error: quotaResponse.code || 'quota_exceeded',
                code: quotaResponse.code || 'QUOTA_EXCEEDED',
                message: quotaResponse.message || 'Usage limit exceeded',
                exceeded: quotaResponse.exceeded,
                remaining: quotaResponse.remaining,
                retry_after: quotaResponse.retryAfter,
                upgrade_url: quotaResponse.upgradeUrl,
                polar_customer_id: quotaResponse.polarCustomerId,
                dunning_state: quotaResponse.dunningState,
                dunning_reason: quotaResponse.dunningReason,
              },
              {
                status: 429,
                headers: {
                  'Content-Type': 'application/json',
                  'Retry-After': String(quotaResponse.retryAfter || 3600),
                  'X-RateLimit-Limit': String(quotaResponse.exceeded?.limit || 0),
                  'X-RateLimit-Remaining': '0',
                  'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + (quotaResponse.retryAfter || 3600)),
                },
              }
            ),
            tier: result.tier,
            quotaExceeded: true,
          };
        }

        // Record circuit success after allowed request
        await recordCircuitSuccess(license.nonce);

        // Store quota warning flag if approaching limit
        if (quotaResult.result.warningThreshold) {
          logger.warn('[RaaS Gate] Quota warning threshold reached', {
            userId,
            licenseNonce: license.nonce.slice(0, 8) + '...',
            remaining: quotaResult.result.remaining,
          });

          return {
            valid: true,
            tier: result.tier,
            receipt: receipt ? serializeReceiptForHeader(receipt) : undefined,
            quotaWarning: true,
            quotaRemaining: quotaResult.result.remaining,
          };
        }

        // Store quota remaining for X-RateLimit headers on successful requests
        request.headers.set('x-quota-remaining', JSON.stringify(quotaResult.result.remaining));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[RaaS Gate] Quota check error', error as Error);

      // Record circuit failure if we have license nonce
      if (licenseNonceForError) {
        await recordCircuitFailure(licenseNonceForError, error instanceof Error ? error : new Error(errorMessage));
      }

      // Fail-closed for quota checks: block if cannot verify
      // But allow bypass for non-critical errors
      const failClosed = process.env.QUOTA_FAIL_CLOSED === 'true';
      if (failClosed) {
        logger.warn('[RaaS Gate] Fail-closed mode: blocking due to quota check failure');

        return {
          valid: false,
          response: NextResponse.json(
            {
              error: 'Quota check failed',
              message: 'Unable to verify quota. Please try again later.',
              code: 'quota_check_error',
            },
            {
              status: 503,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '30',
              },
            }
          ),
          tier: result.tier,
        };
      }
      // Fail-open: allow request if quota check fails (non-critical)
      logger.warn('[RaaS Gate] Fail-open mode: allowing request despite quota check failure');
    }
  }

  return {
    valid: true,
    tier: result.tier,
    receipt: receipt ? serializeReceiptForHeader(receipt) : undefined
  };
}

/**
 * Check if RaaS gate should be applied to this route
 *
 * Excluded routes (public access):
 * - /api/health - Health checks
 * - /api/setup/* - Initial setup wizard
 * - /api/webhooks/polar - Polar.sh webhooks (have their own auth)
 * - /api/webhooks/telegram - Telegram webhooks (have their own auth)
 */
export function shouldApplyRaasGate(pathname: string): boolean {
  // Public routes
  const publicRoutes = [
    '/api/health',
    '/api/setup',
    '/api/webhooks/polar',
    '/api/webhooks/telegram',
    '/api/auth',
    '/api/discovery',
    '/api/sophia-index',
  ];

  // Check if pathname matches any public route
  const isPublic = publicRoutes.some(route => pathname.startsWith(route));

  return !isPublic;
}

/**
 * Get current RaaS configuration status
 */
export function getRaaSConfig(): {
  enabled: boolean;
  bypassDev: boolean;
  isDev: boolean;
  hasSecret: boolean;
  v1Format: boolean;
} {
  const isDev = process.env.NODE_ENV === 'development';
  const bypassDev = process.env.RAAS_BYPASS_DEV === 'true';
  const hasLicenseKey = !!process.env.RAAS_LICENSE_KEY;
  const hasSecret = !!process.env.RAAS_LICENSE_SECRET;
  const v1Format = process.env.RAAS_V1_FORMAT === 'true';

  return {
    enabled: hasLicenseKey || !bypassDev,
    bypassDev,
    isDev,
    hasSecret,
    v1Format,
  };
}

export default raasGate;
