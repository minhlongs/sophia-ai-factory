'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Clock, DollarSign, ExternalLink, Share2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/stitch';
import type { AffiliateOffer } from '@/seed/types/affiliate';

interface PayoutTermsProps {
  offer: AffiliateOffer;
  subId: string;
  onSubIdChange: (value: string) => void;
  generatedTrackingUrl: string;
  copied: boolean;
  onCopyLink: () => Promise<void>;
}

export function PayoutTerms({
  offer,
  subId,
  onSubIdChange,
  generatedTrackingUrl,
  copied,
  onCopyLink,
}: PayoutTermsProps) {
  const t = useTranslations('stitch.affiliates.drawer');

  return (
    <>
      {/* Commission & Attribution Terms */}
      <div className="mt-6 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-border dark:border-white/[0.06] space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t('commissionTerms')}
        </h4>

        <div className="flex items-center justify-between text-sm py-1 border-b border-border dark:border-white/[0.04]">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" />
            {t('cookieWindow')}
          </span>
          <span className="font-semibold text-foreground dark:text-white">
            {t('days', { days: offer.cookieWindowDays })}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm py-1 border-b border-border dark:border-white/[0.04]">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-primary" />
            {t('minPayout')}
          </span>
          <span className="font-semibold text-foreground dark:text-white">
            ${offer.minPayoutUsd.toFixed(2)} USD
          </span>
        </div>

        <div className="flex items-center justify-between text-sm py-1">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <ExternalLink className="w-4 h-4 text-primary" />
            {t('destinationUrl')}
          </span>
          <a
            href={offer.destinationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline max-w-[220px] truncate inline-flex items-center gap-1"
          >
            <span className="truncate">{offer.destinationUrl}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>
      </div>

      {/* Live Affiliate Tracking Link Generator */}
      <div className="mt-6 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-border dark:border-white/[0.06]">
        <div className="flex items-center gap-2 mb-2">
          <Share2 className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-bold text-foreground dark:text-white">
            {t('linkGenerator')}
          </h4>
        </div>

        <label
          htmlFor="subid-input"
          className="block text-xs font-medium text-muted-foreground mb-1.5"
        >
          {t('subIdLabel')}
        </label>
        <input
          id="subid-input"
          type="text"
          value={subId}
          onChange={(e) => onSubIdChange(e.target.value)}
          placeholder={t('subIdPlaceholder')}
          className="w-full h-10 px-3.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-sm text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all font-mono"
        />

        <div className="mt-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            {t('generatedUrl')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={generatedTrackingUrl}
              className="flex-1 h-10 px-3.5 rounded-lg bg-black/[0.02] dark:bg-black/40 border border-border dark:border-white/[0.08] text-xs text-muted-foreground select-all font-mono truncate"
            />
            <Button
              variant={copied ? 'secondary' : 'outline'}
              size="md"
              onClick={onCopyLink}
              iconLeft={
                copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )
              }
            >
              {copied ? t('copied') : t('copyLink')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
