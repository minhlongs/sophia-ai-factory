'use client'

import React, { useState, useTransition } from 'react'
import { Sparkles, ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Card, Button, Badge, Input } from '@/components/stitch'
import { discoverAffiliateOffersAction } from '@/land/affiliates/actions/discover-offers-action'
import { convertOfferToCampaignAction } from '@/land/affiliates/actions/convert-offer-action'
import type { RankedDiscoveredOffer } from '@/land/affiliates/discovery-wave'
import { AffiliateOfferCard } from './affiliate-offer-card'

const NICHES = ['saas', 'ai', 'marketing', 'health', 'finance', 'education']

export function AffiliateDiscoveryPanel() {
  const [niche, setNiche] = useState('saas')
  const [minScore, setMinScore] = useState(0.5)
  const [offers, setOffers] = useState<RankedDiscoveredOffer[]>([])
  const [stats, setStats] = useState<{ scanned: number; qualified: number } | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleRunDiscovery = () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await discoverAffiliateOffersAction({
        niche,
        minScore,
        limit: 12,
        networks: ['clickbank', 'awin', 'shareasale'],
      })
      if (!res.ok) {
        setErrorMsg(res.error.message)
        return
      }
      setOffers(res.value.topOffers)
      setStats({ scanned: res.value.scannedCount, qualified: res.value.qualifiedCount })
    })
  }

  const handleCreateCampaign = async (offer: RankedDiscoveredOffer) => {
    setErrorMsg(null)
    setSuccessMsg(null)
    setConvertingId(offer.externalId)
    try {
      const res = await convertOfferToCampaignAction({ offer })
      if (!res.ok) {
        setErrorMsg(`Campaign creation failed: ${res.error.message}`)
      } else {
        const title = res.value.script.primary.suggestedTitles[0] || offer.title
        setSuccessMsg(`Campaign initialized: "${title}" (Mission: ${res.value.missionId.slice(0, 8)})`)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Campaign creation failed')
    } finally {
      setConvertingId(null)
    }
  }

  return (
    <div className="space-y-md">
      <Card padding="md" className="border border-primary/20 bg-primary/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
          <div>
            <div className="flex items-center gap-xs text-primary font-semibold text-body-md">
              <Sparkles className="w-4 h-4" />
              <span>Agentic Affiliate Discovery Wave</span>
            </div>
            <p className="text-on-surface-variant text-body-sm mt-xs">
              Autonomous multi-network crawler scanning ClickBank, Awin, and ShareASale with scam verification.
            </p>
          </div>
          <Button
            onClick={handleRunDiscovery}
            disabled={isPending}
            iconLeft={isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          >
            {isPending ? 'Discovering...' : 'Run Discovery Wave'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-md mt-md pt-md border-t border-outline/10">
          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-xs">Target Niche</label>
            <div className="flex flex-wrap gap-xs">
              {NICHES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNiche(n)}
                  className={`px-sm py-xs rounded-lg text-label-sm font-medium capitalize transition-colors ${
                    niche === n ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant hover:bg-surface-variant/80'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-xs">
              Min Quality Score: {Math.round(minScore * 100)}%
            </label>
            <Input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={String(minScore)}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="w-full cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-xs">Active Networks</label>
            <div className="flex items-center gap-xs">
              <Badge variant="soft" color="primary">ClickBank</Badge>
              <Badge variant="soft" color="secondary">Awin</Badge>
              <Badge variant="soft" color="success">ShareASale</Badge>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-sm p-sm rounded-lg bg-error-container text-on-error-container text-body-sm">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mt-sm p-sm rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-body-sm flex items-center gap-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {stats && (
          <div className="mt-sm flex items-center gap-md text-label-sm text-on-surface-variant">
            <span>Scanned: <strong>{stats.scanned} offers</strong></span>
            <span>Qualified: <strong>{stats.qualified} offers</strong></span>
            <span className="flex items-center gap-xs text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Scam Gated
            </span>
          </div>
        )}
      </Card>

      {offers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {offers.map((offer) => (
            <AffiliateOfferCard
              key={`${offer.network}-${offer.externalId}`}
              offer={offer}
              isConverting={convertingId === offer.externalId}
              onCreateCampaign={handleCreateCampaign}
            />
          ))}
        </div>
      )}
    </div>
  )
}
