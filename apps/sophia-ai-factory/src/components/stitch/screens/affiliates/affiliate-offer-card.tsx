'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ExternalLink,
  Check,
  Copy,
  TrendingUp,
  DollarSign,
  Percent,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button, Badge } from '@/components/stitch';
import type { AffiliateOffer } from '@/seed/types/affiliate';

export interface AffiliateOfferCardProps {
  offer: AffiliateOffer;
  onViewDetails?: (offer: AffiliateOffer) => void;
  isConverting?: boolean;
  onCreateCampaign?: (offer: AffiliateOffer) => void;
}

export function AffiliateOfferCard({
  offer,
  onViewDetails,
  isConverting = false,
  onCreateCampaign,
}: AffiliateOfferCardProps) {
  const t = useTranslations('stitch.affiliates.discovery.card');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(offer.destinationUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Non-fatal
    }
  };

  const handleOpenDetails = () => {
    if (onViewDetails) {
      onViewDetails(offer);
    } else if (onCreateCampaign) {
      onCreateCampaign(offer);
    }
  };

  const displayName = offer.programName || 'Partner Program';
  const categoryLabel = offer.category || 'SaaS';
  const payoutModelLabel = offer.payoutModel || 'RevShare';
  const commissionRate = offer.commissionRatePct ?? 20;
  const epcValue = offer.epc != null ? offer.epc.toFixed(2) : '0.00';
  const convRateValue = offer.conversionRatePct != null ? offer.conversionRatePct.toFixed(1) : '0.0';
  const qualityScoreValue = offer.qualityScore != null ? offer.qualityScore.toFixed(1) : '9.0';

  return (
    <div className="group relative rounded-2xl bg-card/85 dark:bg-[#12141F]/80 backdrop-blur-xl border border-border dark:border-white/[0.08] hover:border-primary/40 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 p-5 flex flex-col justify-between font-sans">
      <div>
        {/* Badges Header */}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" color="primary">
              {categoryLabel}
            </Badge>
            <Badge variant="soft" color="secondary">
              {payoutModelLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{qualityScoreValue}/10</span>
          </div>
        </div>

        {/* Title & Terms */}
        <h4 className="text-base font-bold text-foreground dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
          {displayName}
        </h4>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[32px]">
          {offer.commissionTerms || `${commissionRate}% commission`}
        </p>

        {/* KPI Metrics Row */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border dark:border-white/[0.06]">
          <div className="text-center p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
              <Percent className="w-3 h-3 text-primary" />
              <span>{t('commission')}</span>
            </div>
            <div className="text-sm font-bold text-foreground dark:text-white mt-0.5">
              {commissionRate}%
            </div>
          </div>

          <div className="text-center p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              <span>{t('epc')}</span>
            </div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">
              ${epcValue}
            </div>
          </div>

          <div className="text-center p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
              <TrendingUp className="w-3 h-3 text-indigo-400" />
              <span>{t('convRate')}</span>
            </div>
            <div className="text-sm font-bold text-indigo-400 mt-0.5">
              {convRateValue}%
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="mt-4 pt-3 border-t border-border dark:border-white/[0.06] flex items-center justify-between gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenDetails}
          disabled={isConverting}
          className="flex-1"
          iconLeft={<Sparkles className="w-3.5 h-3.5" />}
        >
          {isConverting ? t('adopting') : t('adoptOffer')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          iconLeft={
            copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )
          }
        >
          {copied ? t('copied') : t('copyLink')}
        </Button>

        {offer.destinationUrl && (
          <a
            href={offer.destinationUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t('visitSite')} - ${displayName}`}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}
