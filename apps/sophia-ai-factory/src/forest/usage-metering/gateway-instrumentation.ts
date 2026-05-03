/**
 * API Gateway Instrumentation — track all API requests for usage metering
 * @module usage-metering/gateway-instrumentation
 */

import type { NextRequest } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import { trackUsage, calculateCredits, hashLicenseKey } from './tracker'
import type { UsageEventInput, AiService } from './types'
import { extractLicenseInfo, shouldExcludeTracking, getSamplingRate, determineServiceFromPath, determineActionFromPath } from './gateway-instrumentation-helpers'

export interface GatewayContext {
  userId: string
  licenseNonce: string
  tier: string
  licenseKeyHash: string
}

export function startGatewayTimer(): () => number {
  const startMs = Date.now()
  return () => Date.now() - startMs
}

export async function emitUsageEvent(
  request: NextRequest,
  response: { status: number; headers?: Headers },
  context?: Partial<GatewayContext>
): Promise<void> {
  if (process.env.USAGE_METERING_ENABLED === 'false') return

  const pathname = request.nextUrl.pathname
  if (shouldExcludeTracking(pathname)) return

  const samplingRate = getSamplingRate(pathname)
  if (samplingRate < 1.0 && Math.random() > samplingRate) {
    logger.debug('[Gateway Instrumentation] Skipped due to sampling', { pathname, samplingRate })
    return
  }

  try {
    const licenseInfo = context?.licenseNonce
      ? { licenseKey: null, licenseNonce: context.licenseNonce, tier: context.tier || 'BASIC' }
      : extractLicenseInfo(request)

    if (!licenseInfo.licenseNonce && !pathname.startsWith('/api')) return

    const userId = licenseInfo.licenseNonce || `anon_${request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'}`
    const licenseNonce = licenseInfo.licenseNonce || 'none'
    const tier = context?.tier || licenseInfo.tier || 'BASIC'
    const licenseKeyHash = licenseInfo.licenseKey ? hashLicenseKey(licenseInfo.licenseKey) : 'none'

    const responseTimeMs = response.headers?.get('x-response-time-ms') ? parseInt(response.headers.get('x-response-time-ms')!, 10) : 0
    const service = determineServiceFromPath(pathname) as AiService
    const action = determineActionFromPath(pathname) || 'request'
    const creditsUsed = calculateCredits(service, action, undefined, tier)

    const event: UsageEventInput = {
      userId, licenseNonce, licenseKeyHash, service, action, endpoint: pathname, creditsUsed,
      statusCode: response.status, responseTimeMs, tierAtRequest: tier,
      resourceType: response.status === 429 ? 'rate_limited' : 'api_call',
      errorMessage: response.status >= 400 ? `HTTP ${response.status}` : undefined,
    }

    const result = await trackUsage(event)
    logger.debug('[Gateway Instrumentation] Emitted usage event', { pathname, status: response.status, tier, credits: creditsUsed, isRateLimited: response.status === 429, idempotencyStatus: result.success ? 'new' : result.reason })
  } catch (error) {
    logger.error('[Gateway Instrumentation] Error emitting usage event', error instanceof Error ? error : new Error(String(error)))
  }
}

export async function withGatewayInstrumentation<T extends Response>(
  request: NextRequest,
  handler: () => Promise<T>,
  context?: Partial<GatewayContext>
): Promise<T> {
  const endTimer = startGatewayTimer()
  try {
    const response = await handler()
    const responseTimeMs = endTimer()
    const responseWithHeader = new Response(response.body, { status: response.status, statusText: response.statusText, headers: new Headers(response.headers) })
    responseWithHeader.headers.set('x-response-time-ms', responseTimeMs.toString())
    emitUsageEvent(request, { status: response.status, headers: responseWithHeader.headers }, context)
      .catch(err => logger.error('[Gateway Instrumentation] Async emission failed', err))
    return responseWithHeader as T
  } catch (error) {
    endTimer()
    throw error
  }
}
