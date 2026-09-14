'use client'

import React, { useState, useTransition } from 'react'
import { Sparkles, ShieldCheck, ExternalLink, RefreshCw, Check, Copy } from 'lucide-react'
import { Card, Button, Badge, Input } from '@/components/stitch'
import { discoverAffiliateOffersAction } from '@/land/affiliates/actions/discover-offers-action'
import type { RankedDiscoveredOffer } from '@/land/affiliates/discovery-wave'

const NICHES = ['saas', 'ai', 'marketing', 'health', 'finance', 'education']

export function AffiliateDiscoveryPanel() {
  const [niche, setNiche] = useState('saas')
  const [minScore, setMinScore] = useState(0.5)
  const [offers, setOffers] = useState<RankedDiscoveredOffer[]>([])
  const [stats, setStats] = useState<{ scanned: number; qualified: number } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleRunDiscovery = () => {
    setErrorMsg(null)
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
      setStats({
        scanned: res.value.scannedCount,
        qualified: res.value.qualifiedCount,
      })
    })
  }

  const handleCopy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Ignore clipboard write error
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
              Autonomous multi-network crawler scanning ClickBank, Awin, and ShareASale with 6-factor composite scoring and fail-closed scam verification.
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
            <label className="block text-label-sm font-medium text-on-surface-variant mb-xs">
              Target Niche
            </label>
            <div className="flex flex-wrap gap-xs">
              {NICHES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNiche(n)}
                  className={`px-sm py-xs rounded-lg text-label-sm font-medium capitalize transition-colors ${
                    niche === n
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-variant text-on-surface-variant hover:bg-surface-variant/80'
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
            <label className="block text-label-sm font-medium text-on-surface-variant mb-xs">
              Active Networks
            </label>
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
            <Card key={`${offer.network}-${offer.externalId}`} padding="md" className="flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-sm mb-xs">
                  <Badge variant="outline" color={offer.network === 'clickbank' ? 'primary' : offer.network === 'awin' ? 'secondary' : 'success'}>
                    {offer.network.toUpperCase()}
                  </Badge>
                  <span className="text-label-sm font-bold text-emerald-600">
                    {Math.round(offer.qualityScore * 100)}% Score
                  </span>
                </div>
                <h4 className="font-headline-sm text-body-lg font-bold text-on-surface line-clamp-1">
                  {offer.title}
                </h4>
                <p className="text-body-sm text-on-surface-variant line-clamp-2 mt-xs">
                  {offer.description || 'High-converting affiliate product ready for autonomous campaign syndication.'}
                </p>
                <div className="mt-sm flex items-center justify-between text-label-sm font-medium">
                  <span className="text-on-surface-variant">Commission</span>
                  <span className="text-primary font-bold">
                    {offer.commissionPct != null ? `${offer.commissionPct}%` : `$${offer.commissionFixedUsd ?? 0}`}
                  </span>
                </div>
              </div>

              <div className="mt-md pt-sm border-t border-outline/10 flex items-center justify-between gap-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(offer.externalId, offer.productUrl)}
                  iconLeft={copiedId === offer.externalId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copiedId === offer.externalId ? 'Copied' : 'Copy Link'}
                </Button>
                {offer.productUrl && (
                  <a
                    href={offer.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-xs text-label-sm text-primary hover:underline"
                  >
                    <span>View Offer</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
