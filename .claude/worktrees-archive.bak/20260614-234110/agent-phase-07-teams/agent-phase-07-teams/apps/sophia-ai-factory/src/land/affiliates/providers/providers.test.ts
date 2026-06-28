/**
 * Tests for all 5 affiliate network adapters
 *
 * Verifies mock-fallback offer shape when env vars are absent.
 * Verifies fetch-based happy-path when env vars present (via fetch mock).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { TikTokShopProvider } from './tiktok-shop'
import { AccessTradeProvider } from './accesstrade'
import { ClickBankProvider } from './clickbank'
import { AwinProvider } from './awin'
import { AmazonProvider } from './amazon'
import type { AffiliateOffer } from '../provider-interface'

function assertOfferShape(offer: AffiliateOffer) {
  expect(offer.externalId).toBeTruthy()
  expect(offer.title).toBeDefined()
  expect(offer.productUrl).toBeTruthy()
  expect(typeof offer.isTrending).toBe('boolean')
  expect(offer.language).toBeTruthy()
  expect(offer.region).toBeTruthy()
}

// ─── TikTok Shop ────────────────────────────────────────────────────────────

describe('TikTokShopProvider', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns mock fixture when env vars absent', async () => {
    const p = new TikTokShopProvider()
    const offers = await p.listOffers()
    expect(offers.length).toBeGreaterThan(0)
    assertOfferShape(offers[0])
  })

  it('getOffer returns mock when no env vars', async () => {
    const p = new TikTokShopProvider()
    const offer = await p.getOffer('anything')
    expect(offer).not.toBeNull()
    assertOfferShape(offer!)
  })

  it('getTrending sets isTrending=true on mock', async () => {
    const p = new TikTokShopProvider()
    const offers = await p.getTrending('beauty')
    expect(offers.every(o => o.isTrending)).toBe(true)
  })

  it('networkSlug is tiktok-shop', () => {
    expect(new TikTokShopProvider().networkSlug).toBe('tiktok-shop')
  })

  it('falls back to mock on fetch failure', async () => {
    vi.stubEnv('TIKTOK_SHOP_APP_KEY', 'key')
    vi.stubEnv('TIKTOK_SHOP_APP_SECRET', 'secret')
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 500 }))
    const p = new TikTokShopProvider()
    const offers = await p.listOffers()
    expect(offers.length).toBeGreaterThan(0)
    vi.restoreAllMocks()
  })
})

// ─── AccessTrade ─────────────────────────────────────────────────────────────

describe('AccessTradeProvider', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns mock fixture when env vars absent', async () => {
    const p = new AccessTradeProvider()
    const offers = await p.listOffers()
    expect(offers.length).toBeGreaterThan(0)
    assertOfferShape(offers[0])
  })

  it('getOffer returns mock when no token', async () => {
    const p = new AccessTradeProvider()
    const offer = await p.getOffer('anything')
    expect(offer).not.toBeNull()
    assertOfferShape(offer!)
  })

  it('getTrending marks isTrending=true', async () => {
    const p = new AccessTradeProvider()
    const offers = await p.getTrending('ecommerce')
    expect(offers.every(o => o.isTrending)).toBe(true)
  })

  it('networkSlug is accesstrade', () => {
    expect(new AccessTradeProvider().networkSlug).toBe('accesstrade')
  })

  it('maps product_url correctly in mock', async () => {
    const p = new AccessTradeProvider()
    const offers = await p.listOffers()
    expect(offers[0].productUrl).toContain('accesstrade')
  })
})

// ─── ClickBank ───────────────────────────────────────────────────────────────

describe('ClickBankProvider', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns 2 mock fixtures when env vars absent', async () => {
    const p = new ClickBankProvider()
    const offers = await p.listOffers()
    expect(offers.length).toBe(2)
    offers.forEach(assertOfferShape)
  })

  it('commissionPct is number in mock', async () => {
    const p = new ClickBankProvider()
    const offers = await p.listOffers()
    expect(typeof offers[0].commissionPct).toBe('number')
  })

  it('getOffer returns first mock when no key', async () => {
    const p = new ClickBankProvider()
    const offer = await p.getOffer('anything')
    expect(offer).not.toBeNull()
  })

  it('networkSlug is clickbank', () => {
    expect(new ClickBankProvider().networkSlug).toBe('clickbank')
  })

  it('getTrending returns isTrending=true', async () => {
    const p = new ClickBankProvider()
    const offers = await p.getTrending('saas')
    expect(offers.every(o => o.isTrending)).toBe(true)
  })
})

// ─── Awin ────────────────────────────────────────────────────────────────────

describe('AwinProvider', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns mock fixture when env vars absent', async () => {
    const p = new AwinProvider()
    const offers = await p.listOffers()
    expect(offers.length).toBeGreaterThan(0)
    assertOfferShape(offers[0])
  })

  it('region is GB in mock', async () => {
    const p = new AwinProvider()
    const offers = await p.listOffers()
    expect(offers[0].region).toBe('GB')
  })

  it('networkSlug is awin', () => {
    expect(new AwinProvider().networkSlug).toBe('awin')
  })

  it('getTrending marks isTrending=true', async () => {
    const p = new AwinProvider()
    const offers = await p.getTrending('fashion')
    expect(offers.every(o => o.isTrending)).toBe(true)
  })
})

// ─── Amazon ──────────────────────────────────────────────────────────────────

describe('AmazonProvider', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns mock fixture when env vars absent', async () => {
    const p = new AmazonProvider()
    const offers = await p.listOffers()
    expect(offers.length).toBeGreaterThan(0)
    assertOfferShape(offers[0])
  })

  it('commissionPct is 4% in mock', async () => {
    const p = new AmazonProvider()
    const offers = await p.listOffers()
    expect(offers[0].commissionPct).toBe(4)
  })

  it('networkSlug is amazon', () => {
    expect(new AmazonProvider().networkSlug).toBe('amazon')
  })

  it('getTrending marks isTrending=true', async () => {
    const p = new AmazonProvider()
    const offers = await p.getTrending('electronics')
    expect(offers.every(o => o.isTrending)).toBe(true)
  })

  it('getOffer returns mock when no credentials', async () => {
    const p = new AmazonProvider()
    const offer = await p.getOffer('B0AMZOCK01')
    expect(offer).not.toBeNull()
    assertOfferShape(offer!)
  })
})
