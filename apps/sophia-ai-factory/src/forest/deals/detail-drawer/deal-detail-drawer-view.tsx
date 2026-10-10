'use client';

/**
 * DealDetailDrawerView — responsive drawer view container
 *
 * Layer: forest/deals/detail-drawer
 */

import React from 'react';
import type { DealDetailDrawerProps } from './types';
import { DealHeader } from './deal-header';
import { DealStageChanger } from './deal-stage-changer';
import { DealSections } from './deal-sections';

export function DealDetailDrawerView({
  deal,
  enrichment,
  isOpen,
  onClose,
  onStageChange,
  onEnrich,
  onOpenMeetingPrep,
  onOpenProposal,
  onOpenSandbox,
  isEnriching = false,
}: DealDetailDrawerProps) {
  if (!isOpen || !deal) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl h-full bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col text-zinc-100 overflow-hidden">
        <DealHeader
          deal={deal}
          onClose={onClose}
          onEnrich={onEnrich}
          onOpenMeetingPrep={onOpenMeetingPrep}
          onOpenProposal={onOpenProposal}
          onOpenSandbox={onOpenSandbox}
          isEnriching={isEnriching}
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          <DealStageChanger
            currentStage={deal.dealStage}
            onStageChange={onStageChange}
          />

          <DealSections
            deal={deal}
            enrichment={enrichment}
          />
        </div>
      </div>
    </div>
  );
}
