/**
 * Domain-specific server-side PostHog capture helpers.
 *
 * Layer: tree/signals
 *
 * @module tree/signals/posthog-domain-events
 */

import { Events } from './event-types'
import { captureServer } from './posthog-capture'

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
