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

  it.each([
    '/api/webhooks/accesstrade',
    '/api/webhooks/amazon',
    '/api/webhooks/awin',
    '/api/webhooks/tiktok-shop',
    '/api/webhooks/saas-crypto/partnerstack',
    '/api/webhooks/saas-crypto/rewardful',
    '/api/webhooks/saas-crypto/binance',
    '/api/webhooks/saas-crypto/bybit',
    '/api/webhooks/affiliate/tiktok_shop',
    '/api/webhooks/affiliate/tiktok-shop',
    '/api/webhooks/affiliate/amazon_associates',
    '/api/webhooks/affiliate/amazon',
    '/api/webhooks/affiliate/clickbank',
    '/api/webhooks/affiliate/accesstrade',
    '/api/webhooks/affiliate/awin',
    '/api/postback/binance-link',
    '/api/postback/binance',
    '/api/postback/bybit',
    '/api/postback/bitget',
    '/api/postback/okx',
    '/api/postback/partnerstack',
    '/api/postback/rewardful',
    '/api/postback/impact',
    '/api/postback/cj',
    '/api/postback/awin',
    '/api/postback/clickbank',
    '/api/postback/tiktok_shop',
    '/api/postback/generic',
  ])('allows signature-verified postback route %s without a browser session', (path) => {
    expect(isPublicApiRoute(path)).toBe(true)
  })
})

describe('isPublicApiRoute — routes that must stay guarded', () => {
  it.each([
    '/api/payos',
    '/api/admin/payouts',
    '/api/user/byok',
    '/api/webhooks/nowpayments-payout',
    '/api/webhooks/saas-crypto/unknown',
    '/api/webhooks/affiliate/unknown',
    '/api/postback/unknown',
    '/api/postback',
  ])('does not make %s public without a session', (path) => {
    expect(isPublicApiRoute(path)).toBe(false)
  })

  it('does not treat an arbitrary subpath of an allowlisted webhook as public', () => {
    // The pinned-Set rule from the security audit: a new subpath is private by
    // default, so adding a route must be an explicit edit.
    expect(isPublicApiRoute('/api/webhooks/payos/anything')).toBe(false)
  })
})
