'use client';

// i18n-namespace: stitch.affiliates.discovery.card

import React from 'react';
import { ExternalLink, Check, Copy, Sparkles } from 'lucide-react';
import { Button } from '@/components/stitch';

export interface AffiliateOfferActionBarProps {
  displayName: string;
  destinationUrl?: string;
  isConverting: boolean;
  copied: boolean;
  onOpenDetails: () => void;
  onCopy: (e: React.MouseEvent) => void;
  t: (key: string) => string;
}

export function AffiliateOfferActionBar({
  displayName,
  destinationUrl,
  isConverting,
  copied,
  onOpenDetails,
  onCopy,
  t,
}: AffiliateOfferActionBarProps) {
  return (
    <div className="mt-4 pt-3 border-t border-border dark:border-white/[0.06] flex items-center justify-between gap-2">
      <Button
        variant="primary"
        size="sm"
        onClick={onOpenDetails}
        disabled={isConverting}
        className="flex-1"
        iconLeft={<Sparkles className="w-3.5 h-3.5" />}
      >
        {isConverting ? t('adopting') : t('adoptOffer')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onCopy}
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

      {destinationUrl && (
        <a
          href={destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t('visitSite')} - ${displayName}`}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
