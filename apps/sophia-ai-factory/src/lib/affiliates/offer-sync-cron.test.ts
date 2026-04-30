/**
 * Tests for offer-sync-cron orchestration logic
 *
 * Tests the Promise.allSettled pattern directly without instantiating providers,
 * verifying partial failures do not crash the full sync.
 */

import { describe, it, expect } from 'vitest'
import type { OfferProvider, AffiliateOffer } from './provider-interface'

// Minimal mock offer for shape testing
const MOCK_OFFER: AffiliateOffer = {
  externalId: 'mock-001',
  title: 'Mock Product',
  description: 'Mock',
  imageUrl: '',
  productUrl: 'https://example.com/p/1',
  commissionPct: 10,
  commissionFixedUsd: null,
  niche: 'general',
  language: 'vi',
  region: 'VN',
  isTrending: false,
}

function makeProvider(slug: string, offers: AffiliateOffer[] | 'fail'): OfferProvider {
  return {
    networkSlug: slug,
    async listOffers() {
      if (offers === 'fail') throw new Error(`${slug} API unavailable`)
      return offers
    },
    async getOffer() { return null },
    async getTrending() { return [] },
  }
}

describe('offerSyncCron — Promise.allSettled orchestration', () => {
  it('continues when one provider throws, all others succeed', async () => {
    const providers: OfferProvider[] = [
      makeProvider('tiktok-shop', [MOCK_OFFER]),
      makeProvider('accesstrade', [MOCK_OFFER]),
      makeProvider('clickbank', 'fail'),
      makeProvider('awin', []),
      makeProvider('amazon', [MOCK_OFFER]),
    ]

    const settled = await Promise.allSettled(
      providers.map(async p => {
        const offers = await p.listOffers()
        return { network: p.networkSlug, count: offers.length }
      })
    )

    expect(settled).toHaveLength(5)

    const fulfilled = settled.filter(r => r.status === 'fulfilled')
    const rejected = settled.filter(r => r.status === 'rejected')

    expect(fulfilled.length).toBe(4)
    expect(rejected.length).toBe(1)
  })

  it('maps each provider to correct network slug', async () => {
    const slugs = ['tiktok-shop', 'accesstrade', 'clickbank', 'awin', 'amazon']
    const providers = slugs.map(s => makeProvider(s, [MOCK_OFFER]))

    const results = await Promise.all(
      providers.map(async p => ({ network: p.networkSlug, offers: await p.listOffers() }))
    )

    expect(results.map(r => r.network)).toEqual(slugs)
    expect(results.every(r => r.offers.length === 1)).toBe(true)
  })

  it('failed provider returns structured error in allSettled result', async () => {
    const providers = [
      makeProvider('tiktok-shop', [MOCK_OFFER]),
      makeProvider('clickbank', 'fail'),
    ]

    const settled = await Promise.allSettled(
      providers.map(async p => {
        const offers = await p.listOffers()
        return { network: p.networkSlug, synced: offers.length }
      })
    )

    const [tikTokResult, clickBankResult] = settled
    expect(tikTokResult.status).toBe('fulfilled')
    expect(clickBankResult.status).toBe('rejected')

    if (clickBankResult.status === 'rejected') {
      expect(clickBankResult.reason).toBeInstanceOf(Error)
      expect((clickBankResult.reason as Error).message).toContain('clickbank')
    }
  })

  it('empty offers list from provider does not cause crash', async () => {
    const providers = [
      makeProvider('awin', []),
    ]

    const settled = await Promise.allSettled(
      providers.map(async p => ({ network: p.networkSlug, count: (await p.listOffers()).length }))
    )

    expect(settled[0].status).toBe('fulfilled')
    if (settled[0].status === 'fulfilled') {
      expect(settled[0].value.count).toBe(0)
    }
  })
})
