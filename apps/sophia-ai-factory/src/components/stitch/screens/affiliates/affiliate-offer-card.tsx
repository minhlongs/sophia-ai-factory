'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/stitch';
import type { AffiliateOffer } from '@/seed/types/affiliate';
import { AffiliateOfferKpiRow } from './affiliate-offer-kpi-row';
import {
  AffiliateOfferActionBar,
  type AffiliateOfferActionBarProps,
} from './affiliate-offer-action-bar';

export { AffiliateOfferActionBar, type AffiliateOfferActionBarProps };

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
        <AffiliateOfferKpiRow
          commissionRate={commissionRate}
          epcValue={epcValue}
          convRateValue={convRateValue}
        />
      </div>

      {/* Action Bar */}
      <AffiliateOfferActionBar
        displayName={displayName}
        destinationUrl={offer.destinationUrl}
        isConverting={isConverting}
        copied={copied}
        onOpenDetails={handleOpenDetails}
        onCopy={handleCopy}
        t={t}
      />
    </div>
  );
}
