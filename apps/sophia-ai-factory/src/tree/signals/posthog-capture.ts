/**
 * Server-side PostHog event capture via direct Capture API (no SDK — edge reliable)
 * RED-TEAM #11: refuses client-source emission of server-only events
 * Fire-and-forget friendly: resolves quickly, errors silently logged
 */

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'
import { isServerOnly, validateEventProps, type EventName, Events } from './event-types'

const POSTHOG_ENDPOINT = 'https://us.i.posthog.com/i/v0/e/'

interface CaptureOptions {
  event: EventName | string
  distinctId: string
  properties?: Record<string, unknown>
  /** 'server' = trusted path; 'client' = from browser relay — blocks server-only events */
  source: 'server' | 'client'
}

/**
 * Send a single event to PostHog Capture API.
 * Use in server actions / route handlers — not client components.
 */
export async function captureServer(opts: CaptureOptions): Promise<void> {
  const { event, distinctId, properties = {}, source } = opts

  // RED-TEAM #11: block client relay of server-only events
  if (source === 'client' && isServerOnly(event)) {
    const err = new Error(`[signals] Client attempted server-only event: ${event}`)
    logger.warn(err.message)
    throw err
  }

  if (!shouldAllowRequest('posthog')) {
    logger.warn('[signals] PostHog capture skipped — circuit breaker open')
    return
  }
  const apiKey = process.env.POSTHOG_PROJECT_KEY
  if (!apiKey) {
    logger.warn('[signals] POSTHOG_PROJECT_KEY not set — skipping capture')
    return
  }

  // Validate + whitelist properties where schema exists
  let safeProps: Record<string, unknown> = {}
  try {
    safeProps = validateEventProps(event as EventName, properties)
  } catch {
    // Unknown event or schema mismatch — use empty props to avoid PII leak
    safeProps = {}
  }

  const payload = {
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties: { ...safeProps, $lib: 'sophia-server' },
    timestamp: new Date().toISOString(),
  }

  try {
    const res = await fetch(POSTHOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      recordSuccess('posthog');
    } else {
      recordFailure('posthog', classifyError(new Error(`HTTP ${res.status}`)));
      logger.warn('[signals] PostHog capture non-OK', { status: res.status, event })
    }
  } catch (err) {
    recordFailure('posthog', classifyError(err));
    logger.warn('[signals] PostHog capture failed', {
      event,
      error: getErrorMessage(err),
    })
  }
}

/**
 * Convenience alias for tier upgrade event — always server-side
 */
export async function captureTierUpgraded(opts: {
  distinctId: string
  tier: string
  amount: number
  currency: string
}): Promise<void> {
  await captureServer({
    event: Events.TIER_UPGRADED,
    distinctId: opts.distinctId,
    source: 'server',
    properties: {
      tier: opts.tier,
      amount: opts.amount,
      currency: opts.currency,
    },
  })
}

/**
 * Convenience for SOP install event — always server-side
 */
export async function captureSopInstalled(opts: {
  distinctId: string
  listingId?: string
}): Promise<void> {
  await captureServer({
    event: Events.SOP_INSTALLED,
    distinctId: opts.distinctId,
    source: 'server',
    properties: { listingId: opts.listingId },
  })
}

/**
 * Convenience for free quota exhaustion event — always server-side
 */
export async function captureFreeQuotaExhaustion(opts: {
  distinctId: string
  tier: string
  used: number
  limit: number
}): Promise<void> {
  await captureServer({
    event: Events.FREE_QUOTA_EXHAUSTION,
    distinctId: opts.distinctId,
    source: 'server',
    properties: {
      tier: opts.tier,
      used: opts.used,
      limit: opts.limit,
    },
  })
}
