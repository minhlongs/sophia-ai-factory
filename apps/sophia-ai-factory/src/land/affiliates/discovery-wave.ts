/**
 * Agentic Affiliate Discovery Wave
 *
 * Concurrently scans, scores, and ranks high-EPC affiliate products across
 * supported networks: ClickBank, Awin, and ShareASale.
 * Applies composite quality scoring, EPC heuristics, and fail-closed scam gating.
 *
 * Layer: land (business workflow)
 * @module affiliates/discovery-wave
 */

import { ClickBankProvider } from './providers/clickbank'
import { AwinProvider } from './providers/awin'
import { ShareASaleProvider } from './providers/shareasale'
import type { AffiliateOffer, OfferProvider } from './provider-interface'
import { scoreAffiliate } from './scout/scoring'
import type { Affiliate, Network } from './scout/types'
import { success, failure, type Result } from '@/seed/types/result'
import { logger } from '@/seed/utils/logger-utility'

export interface RankedDiscoveredOffer {
  externalId: string
  network: string
  title: string
  description: string
  productUrl: string
  imageUrl: string
  commissionPct: number | null
  commissionFixedUsd: number | null
  niche: string
  language: string
  region: string
  isTrending: boolean
  qualityScore: number
  passesScamGate: boolean
  scoreBreakdown: Record<string, number>
}

export interface DiscoveryWaveQuery {
  niche?: string
  minScore?: number
  limit?: number
  networks?: ('clickbank' | 'awin' | 'shareasale')[]
  tenantId?: string
}

export interface DiscoveryWaveResult {
  scannedCount: number
  qualifiedCount: number
  networkBreakdown: Record<string, number>
  topOffers: RankedDiscoveredOffer[]
  completedAt: string
}

const PROVIDER_MAP: Record<'clickbank' | 'awin' | 'shareasale', () => OfferProvider> = {
  clickbank: () => new ClickBankProvider(),
  awin: () => new AwinProvider(),
  shareasale: () => new ShareASaleProvider(),
}

const NETWORK_CTX: Record<string, { cookieDays: number; payoutFrequency: 'weekly' | 'monthly'; approvalRate: number }> = {
  clickbank: { cookieDays: 60, payoutFrequency: 'weekly', approvalRate: 0.9 },
  awin: { cookieDays: 30, payoutFrequency: 'monthly', approvalRate: 0.75 },
  shareasale: { cookieDays: 45, payoutFrequency: 'monthly', approvalRate: 0.8 },
}

function extractDomain(url?: string): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

function toAffiliate(offer: AffiliateOffer, network: Network, tenantId: string, now: string): Affiliate {
  const epc = offer.commissionPct != null
    ? Math.min(10, Math.max(0.5, (offer.commissionPct / 100) * 8))
    : offer.commissionFixedUsd != null
    ? Math.min(10, Math.max(0.5, offer.commissionFixedUsd * 0.05))
    : 1.0

  return {
    id: `aff_${network}_${offer.externalId}`,
    tenantId,
    network,
    externalId: offer.externalId,
    productName: offer.title,
    productUrl: offer.productUrl,
    commissionPct: offer.commissionPct ?? undefined,
    commissionFlatUsd: offer.commissionFixedUsd ?? undefined,
    category: offer.niche,
    description: offer.description,
    discoveredAt: now,
    epc,
    domain: extractDomain(offer.productUrl),
  }
}

export async function runAgenticDiscoveryWave(
  query: DiscoveryWaveQuery = {}
): Promise<Result<DiscoveryWaveResult, Error>> {
  const {
    niche = 'saas',
    minScore = 0.5,
    limit = 20,
    networks = ['clickbank', 'awin', 'shareasale'],
    tenantId = 'sophia-global',
  } = query

  const now = new Date().toISOString()
  const targetKeys = networks.filter(k => k in PROVIDER_MAP)
  if (targetKeys.length === 0) {
    return failure(new Error('No valid affiliate networks selected for discovery wave'))
  }

  try {
    const providers = targetKeys.map(k => ({ key: k, provider: PROVIDER_MAP[k]() }))
    const settled = await Promise.allSettled(
      providers.map(async ({ key, provider }) => {
        const offers = await provider.listOffers({ niche, limit: 50 })
        return { key, offers }
      })
    )

    const rawOffers: { networkKey: Network; offer: AffiliateOffer }[] = []
    for (const res of settled) {
      if (res.status === 'fulfilled') {
        for (const o of res.value.offers) {
          rawOffers.push({ networkKey: res.value.key as Network, offer: o })
        }
      } else {
        logger.warn('[discovery-wave] network fetch failed', { error: String(res.reason) })
      }
    }

    const scoredOffers: RankedDiscoveredOffer[] = []
    const breakdown: Record<string, number> = {}

    for (const { networkKey, offer } of rawOffers) {
      breakdown[networkKey] = (breakdown[networkKey] ?? 0) + 1
      const aff = toAffiliate(offer, networkKey, tenantId, now)
      const ctx = NETWORK_CTX[networkKey] ?? { cookieDays: 30, payoutFrequency: 'monthly', approvalRate: 0.7 }
      const scored = scoreAffiliate(aff, {
        threshold: minScore,
        cookieDays: ctx.cookieDays,
        payoutFrequency: ctx.payoutFrequency,
        approvalRate: ctx.approvalRate,
      })

      if (scored.passes && scored.score >= minScore) {
        scoredOffers.push({
          externalId: offer.externalId,
          network: networkKey,
          title: offer.title,
          description: offer.description,
          productUrl: offer.productUrl,
          imageUrl: offer.imageUrl,
          commissionPct: offer.commissionPct,
          commissionFixedUsd: offer.commissionFixedUsd,
          niche: offer.niche,
          language: offer.language,
          region: offer.region,
          isTrending: offer.isTrending,
          qualityScore: scored.score,
          passesScamGate: scored.passes,
          scoreBreakdown: scored.breakdown,
        })
      }
    }

    scoredOffers.sort((a, b) => b.qualityScore - a.qualityScore)
    const topOffers = scoredOffers.slice(0, limit)

    return success({
      scannedCount: rawOffers.length,
      qualifiedCount: scoredOffers.length,
      networkBreakdown: breakdown,
      topOffers,
      completedAt: now,
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    logger.error('[discovery-wave] discovery wave execution failed', { error: error.message })
    return failure(error)
  }
}
