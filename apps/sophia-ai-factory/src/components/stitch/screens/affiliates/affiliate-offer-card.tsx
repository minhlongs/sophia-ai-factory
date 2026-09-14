'use client'

import React, { useState } from 'react'
import { ExternalLink, RefreshCw, Check, Copy, Video } from 'lucide-react'
import { Card, Button, Badge } from '@/components/stitch'
import type { RankedDiscoveredOffer } from '@/land/affiliates/discovery-wave'

interface AffiliateOfferCardProps {
  offer: RankedDiscoveredOffer
  isConverting: boolean
  onCreateCampaign: (offer: RankedDiscoveredOffer) => void
}

export function AffiliateOfferCard({
  offer,
  isConverting,
  onCreateCampaign,
}: AffiliateOfferCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(offer.productUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore clipboard write error
    }
  }

  const networkColor =
    offer.network === 'clickbank'
      ? 'primary'
      : offer.network === 'awin'
        ? 'secondary'
        : 'success'

  const commissionText =
    offer.commissionPct != null
      ? `${offer.commissionPct}%`
      : `$${offer.commissionFixedUsd ?? 0}`

  return (
    <Card padding="md" className="flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-sm mb-xs">
          <Badge variant="outline" color={networkColor}>
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
          {offer.description ||
            'High-converting affiliate product ready for autonomous campaign syndication.'}
        </p>
        <div className="mt-sm flex items-center justify-between text-label-sm font-medium">
          <span className="text-on-surface-variant">Commission</span>
          <span className="text-primary font-bold">{commissionText}</span>
        </div>
      </div>

      <div className="mt-md pt-sm border-t border-outline/10 flex items-center justify-between gap-xs flex-wrap">
        <div className="flex items-center gap-xs">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            iconLeft={
              copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )
            }
          >
            {copied ? 'Copied' : 'Copy Link'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={isConverting}
            onClick={() => onCreateCampaign(offer)}
            iconLeft={
              isConverting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Video className="w-3.5 h-3.5" />
              )
            }
          >
            {isConverting ? 'Creating...' : 'Create Campaign'}
          </Button>
        </div>
        {offer.productUrl && (
          <a
            href={offer.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-xs text-label-sm text-primary hover:underline ml-auto"
          >
            <span>View</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </Card>
  )
}
