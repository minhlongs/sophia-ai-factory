/**
 * Public-route allowlist guards against a payment webhook being locked out.
 *
 * The 2026-08-15 security audit replaced broad prefixes with a pinned exact-path
 * Set, deliberately so a new subpath cannot become public by accident. That
 * tradeoff means any webhook route relying on signature auth must be listed
 * explicitly, or the blanket auth guard answers 401 before the signature check
 * ever runs.
 *
 * This suite asserts the webhook routes that authenticate by signature rather
 * than session are all reachable. A missing entry is a silently dead payment
 * endpoint, not a loud failure, so it needs a test rather than a code read.
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest'
import { isPublicApiRoute } from './public-routes'

describe('isPublicApiRoute — signature-authenticated webhooks', () => {
  it.each([
    '/api/webhooks/nowpayments',
    '/api/webhooks/payos',
    '/api/webhooks/clickbank',
    '/api/webhooks/shopify',
    '/api/webhooks/stripe',
  ])('allows %s so provider callbacks reach their signature check', (path) => {
    expect(isPublicApiRoute(path)).toBe(true)
  })

  it('allows the alternate PayOS IPN route that also authenticates by HMAC', () => {
    // PayOS posts to this path from its merchant dashboard config. It verifies an
    // HMAC checksum, so it must not be gated behind a session that a provider
    // callback cannot carry.
    expect(isPublicApiRoute('/api/payos/ipn')).toBe(true)
  })
})

describe('isPublicApiRoute — routes that must stay guarded', () => {
  it.each([
    '/api/payos',
    '/api/admin/payouts',
    '/api/user/byok',
    '/api/webhooks/nowpayments-payout',
  ])('does not make %s public without a session', (path) => {
    expect(isPublicApiRoute(path)).toBe(false)
  })

  it('does not treat an arbitrary subpath of an allowlisted webhook as public', () => {
    // The pinned-Set rule from the security audit: a new subpath is private by
    // default, so adding a route must be an explicit edit.
    expect(isPublicApiRoute('/api/webhooks/payos/anything')).toBe(false)
  })
})
