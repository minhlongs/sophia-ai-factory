/**
 * API Gateway Instrumentation
 *
 * Track ALL API requests (including 429 rate-limited) for usage metering
 *
 * Features:
 * - Emit usage events for every API request
 * - Track rate-limited (429) requests separately
 * - Extract license key from headers for tenant identification
 * - Async emission (non-blocking)
 * - Configurable sampling for high-volume endpoints
 */

import type { NextRequest } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';
import { trackUsage, calculateCredits, startTimer, hashLicenseKey } from './tracker';
import type { UsageEventInput, AiService } from './types';

/**
 * Gateway instrumentation context
 */
export interface GatewayContext {
  userId: string;
  licenseNonce: string;
  tier: string;
  licenseKeyHash: string;
}

/**
 * Extract license info from request headers
 *
 * Priority:
 * 1. X-RaaS-License-Key header
 * 2. Authorization header (Bearer raas_...)
 * 3. Query parameter (license_key) - less secure
 */
function extractLicenseInfo(request: NextRequest): {
  licenseKey: string | null;
  licenseNonce: string | null;
  tier: string;
} {
  // Check custom header
  const headerKey = request.headers.get('x-raas-license-key');
  if (headerKey) {
    // Extract tier from key format: raas_{tier}_...
    const tierMatch = headerKey.match(/^raas_(basic|premium|enterprise|master)_/i);
    const tier = tierMatch ? tierMatch[1].toUpperCase() : 'BASIC';

    // Extract nonce (4th part of key)
    const parts = headerKey.split('_');
    const nonce = parts[3] || null;

    return {
      licenseKey: headerKey,
      licenseNonce: nonce,
      tier,
    };
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.startsWith('raas_')) {
      const tierMatch = token.match(/^raas_(basic|premium|enterprise|master)_/i);
      const tier = tierMatch ? tierMatch[1].toUpperCase() : 'BASIC';
      const parts = token.split('_');
      const nonce = parts[3] || null;

      return {
        licenseKey: token,
        licenseNonce: nonce,
        tier,
      };
    }
  }

  // Check query parameter (for webhook testing only)
  const queryKey = request.nextUrl.searchParams.get('license_key');
  if (queryKey) {
    logger.warn('[Gateway Instrumentation] License key from query param - insecure');
    const tierMatch = queryKey.match(/^raas_(basic|premium|enterprise|master)_/i);
    const tier = tierMatch ? tierMatch[1].toUpperCase() : 'BASIC';
    const parts = queryKey.split('_');
    const nonce = parts[3] || null;

    return {
      licenseKey: queryKey,
      licenseNonce: nonce,
      tier,
    };
  }

  return {
    licenseKey: null,
    licenseNonce: null,
    tier: 'BASIC',
  };
}

/**
 * Check if endpoint should be excluded from tracking
 */
function shouldExcludeTracking(pathname: string): boolean {
  const excludedEndpoints = process.env.USAGE_METERING_EXCLUDED_ENDPOINTS?.split(',') || [
    '/api/health',
    '/api/setup',
    '/api/webhooks',
    '/api/auth',
    '/api/discovery',
    '/api/sophia-index',
    '/api/cron',
  ];

  return excludedEndpoints.some(route => pathname.startsWith(route));
}

/**
 * Get sampling rate for high-volume endpoints
 */
function getSamplingRate(pathname: string): number {
  const sampleRateEnv = process.env.USAGE_METERING_SAMPLE_RATE;
  if (sampleRateEnv) {
    const rate = parseFloat(sampleRateEnv);
    if (rate >= 0 && rate <= 1) {
      return rate;
    }
  }

  // Default: sample high-volume endpoints at 10%
  const highVolumeEndpoints = [
    '/api/chat',
    '/api/completions',
    '/api/stream',
  ];

  if (highVolumeEndpoints.some(endpoint => pathname.startsWith(endpoint))) {
    return 0.1; // 10% sampling
  }

  return 1.0; // 100% tracking
}

/**
 * Emit usage event for API request (async, non-blocking)
 *
 * Usage:
 * 1. At request start: const endTimer = startGatewayTimer()
 * 2. After response: endTimer(response)
 *
 * @param request - Next.js request object
 * @param response - Response object (for status code, timing)
 * @param context - Optional pre-extracted context (from RaaS gate)
 */
export async function emitUsageEvent(
  request: NextRequest,
  response: {
    status: number;
    headers?: Headers;
  },
  context?: Partial<GatewayContext>
): Promise<void> {
  // Check if tracking is enabled
  if (process.env.USAGE_METERING_ENABLED === 'false') {
    return;
  }

  const pathname = request.nextUrl.pathname;

  // Check if endpoint should be excluded
  if (shouldExcludeTracking(pathname)) {
    return;
  }

  // Check sampling rate
  const samplingRate = getSamplingRate(pathname);
  if (samplingRate < 1.0 && Math.random() > samplingRate) {
    logger.debug('[Gateway Instrumentation] Skipped due to sampling', {
      pathname,
      samplingRate,
    });
    return;
  }

  try {
    // Extract license info (or use provided context)
    const licenseInfo = context?.licenseNonce
      ? {
          licenseKey: null,
          licenseNonce: context.licenseNonce,
          tier: context.tier || 'BASIC',
        }
      : extractLicenseInfo(request);

    // Skip if no license and not an API request
    if (!licenseInfo.licenseNonce && !pathname.startsWith('/api')) {
      return;
    }

    // Generate userId from license nonce or fallback to anonymous
    const userId = licenseInfo.licenseNonce || `anon_${request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'}`;
    const licenseNonce = licenseInfo.licenseNonce || 'none';
    const tier = context?.tier || licenseInfo.tier || 'BASIC';
    const licenseKeyHash = licenseInfo.licenseKey ? hashLicenseKey(licenseInfo.licenseKey) : 'none';

    // Calculate response time
    const responseTimeMs = response.headers?.get('x-response-time-ms')
      ? parseInt(response.headers.get('x-response-time-ms')!, 10)
      : 0;

    // Determine service and action from pathname
    const service = determineServiceFromPath(pathname) as AiService;
    const action = determineActionFromPath(pathname) || 'request';

    // Calculate credits (1 credit per API call for gateway tracking)
    const creditsUsed = calculateCredits(service, action, undefined, tier);

    // Build usage event
    const event: UsageEventInput = {
      userId,
      licenseNonce,
      licenseKeyHash,
      service,
      action,
      endpoint: pathname,
      creditsUsed,
      statusCode: response.status,
      responseTimeMs,
      tierAtRequest: tier,
      // Special handling for 429 rate-limited requests
      resourceType: response.status === 429 ? 'rate_limited' : 'api_call',
      // Include error info for non-2xx responses
      errorMessage: response.status >= 400 ? `HTTP ${response.status}` : undefined,
    };

    // Track usage (async, non-blocking)
    const result = await trackUsage(event);

    logger.debug('[Gateway Instrumentation] Emitted usage event', {
      pathname,
      status: response.status,
      tier,
      credits: creditsUsed,
      isRateLimited: response.status === 429,
      idempotencyStatus: result.success ? 'new' : result.reason,
    });
  } catch (error) {
    // Log error but don't fail the request
    logger.error('[Gateway Instrumentation] Error emitting usage event',
      error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Start timer and return function to end timing
 *
 * Usage:
 * ```ts
 * const endTimer = startGatewayTimer();
 * // ... process request ...
 * const responseTimeMs = endTimer();
 * ```
 */
export function startGatewayTimer(): () => number {
  const startMs = Date.now();
  return () => Date.now() - startMs;
}

/**
 * Determine service from request path
 */
function determineServiceFromPath(pathname: string): AiService {
  // Extract service from /api/{service}/... pattern
  const match = pathname.match(/^\/api\/([^/]+)/);
  if (match) {
    const serviceName = match[1];
    // Map to known AiService types
    if (serviceName === 'heygen') return 'heygen';
    if (serviceName === 'elevenlabs') return 'elevenlabs';
    if (serviceName === 'openrouter') return 'openrouter';
    // Default to 'openrouter' for generic AI services
    return 'openrouter';
  }
  return 'openrouter';
}

/**
 * Determine action from request path
 */
function determineActionFromPath(pathname: string): string | undefined {
  // Extract action from /api/service/{action} pattern
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 3) {
    return parts.slice(2).join('/');
  }
  return parts[parts.length - 1] || undefined;
}

/**
 * Middleware wrapper for gateway instrumentation
 *
 * Usage in proxy.ts:
 * ```ts
 * import { withGatewayInstrumentation } from './lib/usage-metering/gateway-instrumentation';
 *
 * export async function proxy(request: NextRequest) {
 *   return withGatewayInstrumentation(request, async () => {
 *     // ... existing proxy logic ...
 *   });
 * }
 * ```
 */
export async function withGatewayInstrumentation<T extends Response>(
  request: NextRequest,
  handler: () => Promise<T>,
  context?: Partial<GatewayContext>
): Promise<T> {
  const endTimer = startGatewayTimer();

  try {
    const response = await handler();

    // Add response time header
    const responseTimeMs = endTimer();
    const responseWithHeader = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
    responseWithHeader.headers.set('x-response-time-ms', responseTimeMs.toString());

    // Emit usage event (async, don't await)
    emitUsageEvent(request, {
      status: response.status,
      headers: responseWithHeader.headers,
    }, context).catch(err => {
      logger.error('[Gateway Instrumentation] Async emission failed', err);
    });

    return responseWithHeader as T;
  } catch (error) {
    // Still track error responses
    endTimer();
    throw error;
  }
}
