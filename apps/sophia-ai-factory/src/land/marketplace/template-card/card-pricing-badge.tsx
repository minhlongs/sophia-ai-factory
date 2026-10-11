'use client';

/**
 * Creator Template Card Pricing Badge & Activation Button
 *
 * Layer: land
 *
 * @module land/marketplace/template-card/card-pricing-badge
 */

import React from 'react';
import { Coins, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import type { CardStatusMessage } from './types';

export interface CardPricingBadgeProps {
  priceUsd: string;
  creatorShareUsd: string;
  isOwner: boolean | undefined | '';
  isPending: boolean;
  statusMsg: CardStatusMessage | null;
  onOpenReviewModal: () => void;
  onActivate: () => void;
}

export function CardPricingBadge({
  priceUsd,
  creatorShareUsd,
  isOwner,
  isPending,
  statusMsg,
  onOpenReviewModal,
  onActivate,
}: CardPricingBadgeProps) {
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-foreground">${priceUsd}</span>
            <span className="text-[11px] text-muted-foreground">USD</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
            <Coins className="h-3 w-3" />
            <span>Creator earns 70% (${creatorShareUsd})</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenReviewModal}
          className="text-xs text-muted-foreground hover:text-foreground underline transition"
        >
          Review
        </button>
      </div>

      {statusMsg && (
        <div
          className={`mb-3 rounded-lg p-2 text-xs flex items-center gap-1.5 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          <span className="truncate">{statusMsg.text}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onActivate}
        disabled={isPending || Boolean(isOwner)}
        title={isOwner ? 'Self-activation prohibited for template creators' : 'Activate blueprint for remixing'}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {isPending ? (
          'Activating...'
        ) : isOwner ? (
          'Your Template (Self-activation blocked)'
        ) : (
          <>
            <Play className="h-3.5 w-3.5 fill-current" />
            Activate Blueprint (${priceUsd})
          </>
        )}
      </button>
    </div>
  );
}
