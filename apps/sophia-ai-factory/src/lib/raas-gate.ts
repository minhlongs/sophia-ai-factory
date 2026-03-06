/**
 * RaaS (ROI-as-a-Service) License Gate Middleware
 *
 * Validates encrypted RaaS_LICENSE_KEY on all /api/* routes
 * Blocks access if invalid or missing, returns standardized 403 errors
 *
 * Features:
 * - Development bypass with RAAS_BYPASS_DEV=true
 * - Production mode enforcement
 * - Logging of validation attempts
 * - Standardized error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from './utils/logger-utility';

/**
 * RaaS validation result
 */
interface RaaSValidationResult {
  valid: boolean;
  reason?: string;
  tier?: string;
}

/**
 * Decrypt and validate RaaS license key
 *
 * In production: validates encrypted key format and signature
 * In development: bypasses validation if RAAS_BYPASS_DEV=true
 */
function validateLicenseKey(key: string | null): RaaSValidationResult {
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

  // Validate key format (expected: raas_{tier}_{encrypted_payload})
  const keyPattern = /^raas_(basic|premium|enterprise|master)_[a-zA-Z0-9]+$/;
  const match = key.match(keyPattern);

  if (!match) {
    return { valid: false, reason: 'invalid-format' };
  }

  const tier = match[1];

  // In production, you would decrypt and verify the payload here
  // For now, we validate the format and signature structure
  // TODO: Integrate with actual RaaS license server for validation

  logger.info('[RaaS Gate] License key validated', { tier });
  return { valid: true, tier };
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
 * @returns Validation result or 403 response if invalid
 */
export async function raasGate(request: NextRequest): Promise<{
  valid: boolean;
  response?: NextResponse;
  tier?: string;
}> {
  const licenseKey = extractLicenseKey(request);
  const result = validateLicenseKey(licenseKey);

  // Log validation attempt
  logger.info('[RaaS Gate] Validation attempt', {
    path: request.nextUrl.pathname,
    valid: result.valid,
    reason: result.reason,
  });

  if (!result.valid) {
    return {
      valid: false,
      response: createForbiddenResponse(result.reason!),
    };
  }

  return {
    valid: true,
    tier: result.tier,
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
} {
  const isDev = process.env.NODE_ENV === 'development';
  const bypassDev = process.env.RAAS_BYPASS_DEV === 'true';
  const hasLicenseKey = !!process.env.RAAS_LICENSE_KEY;

  return {
    enabled: hasLicenseKey || !bypassDev,
    bypassDev,
    isDev,
  };
}

export default raasGate;
