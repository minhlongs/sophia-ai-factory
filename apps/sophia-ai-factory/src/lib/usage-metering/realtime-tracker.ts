/**
 * Real-Time Usage Tracker
 *
 * Sub-second usage aggregation with circuit breaker pattern.
 *
 * Sub-modules:
 *   realtime-tracker-types.ts           — CircuitState, CircuitBreakerConfig, RealTimeUsage
 *   realtime-tracker-circuit-breaker.ts — recordCircuitFailure/Success, canPassCircuitBreaker
 *   realtime-tracker-kv-ops.ts          — getRealTimeUsage, updateRealTimeUsage, invalidateRealTimeCache, hasEmergencyBypass
 *
 * @module usage-metering/realtime-tracker
 */

import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'

export type { CircuitState, CircuitBreakerConfig, RealTimeUsage } from './realtime-tracker-types'
export { recordCircuitFailure, recordCircuitSuccess, canPassCircuitBreaker } from './realtime-tracker-circuit-breaker'
export { getRealTimeUsage, updateRealTimeUsage, invalidateRealTimeCache, hasEmergencyBypass } from './realtime-tracker-kv-ops'

import { canPassCircuitBreaker, recordCircuitFailure, recordCircuitSuccess } from './realtime-tracker-circuit-breaker'
import { getRealTimeUsage, updateRealTimeUsage } from './realtime-tracker-kv-ops'
import type { RealTimeUsage } from './realtime-tracker-types'

export async function trackWithCircuitBreaker(
  userId: string,
  licenseNonce: string,
  tier: string,
  creditsUsed: number,
  windowMs: number = 1000,
): Promise<{ allowed: boolean; reason?: string; currentCredits?: number }> {
  const circuitCheck = await canPassCircuitBreaker(licenseNonce)
  if (!circuitCheck.allowed) {
    logger.warn('[Real-Time Tracker] Blocked by circuit breaker', {
      licenseNonce: licenseNonce.slice(0, 8) + '...', state: circuitCheck.state, reason: circuitCheck.reason,
    })
    return { allowed: false, reason: circuitCheck.reason }
  }
  try {
    let current = await getRealTimeUsage(userId, licenseNonce)
    const now = Date.now()
    const windowStart = Math.floor(now / windowMs) * windowMs
    if (!current || current.windowStart !== windowStart) {
      current = { licenseNonce, userId, tier, currentCredits: creditsUsed, windowStart, windowMs }
    } else {
      current.currentCredits += creditsUsed
    }
    await updateRealTimeUsage(current)
    await recordCircuitSuccess(licenseNonce)
    return { allowed: true, currentCredits: current.currentCredits }
  } catch (error) {
    await recordCircuitFailure(licenseNonce, toError(error))
    return { allowed: false, reason: `tracking-error: ${toError(error).message}` }
  }
}
