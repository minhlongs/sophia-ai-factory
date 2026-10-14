'use client';

/**
 * Enterprise Deals Kanban Board Component
 *
 * Visualizes pipeline deals across Hot (>=75), Warm (50-74), and Cold (<50) BANT tiers.
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/deals-kanban-board
 */

import React from 'react';
import type { EnterpriseDeal, PipelineTier } from '@/seed/types/enterprise-deal';
import { KANBAN_COLUMNS, DealKanbanCard } from './deals-kanban-card';

interface DealsKanbanBoardProps {
  deals: EnterpriseDeal[];
  onSelectDeal: (deal: EnterpriseDeal) => void;
  onOpenMeetingPrep: (deal: EnterpriseDeal) => void;
  onOpenProposal: (deal: EnterpriseDeal) => void;
  onOpenSandbox: (deal: EnterpriseDeal) => void;
}

export function DealsKanbanBoard({
  deals,
  onSelectDeal,
  onOpenMeetingPrep,
  onOpenProposal,
  onOpenSandbox,
}: DealsKanbanBoardProps) {
  const getDealsForTier = (tier: PipelineTier) =>
    deals.filter((d) => d.pipelineTier === tier);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
      {KANBAN_COLUMNS.map((col) => {
        const tierDeals = getDealsForTier(col.tier);
        const Icon = col.icon;
        const totalValue = tierDeals.reduce((sum, d) => sum + (d.dealValueEstimateCents || 0), 0);

        return (
          <div
            key={col.tier}
            className="flex flex-col rounded-xl bg-zinc-950/40 border border-zinc-800/80 overflow-hidden"
          >
            {/* Column Header */}
            <div className={`p-4 border-b ${col.headerClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5" />
                  <h3 className="font-bold text-sm text-white">{col.title}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-zinc-900 border border-zinc-700 text-zinc-300">
                    {tierDeals.length}
                  </span>
                </div>
                <span className="text-xs font-semibold text-zinc-200">
                  ${(totalValue / 100).toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">{col.subtitle}</p>
            </div>

            {/* Cards Container */}
            <div className="p-3 space-y-3 min-h-[400px]">
              {tierDeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-600 text-xs">
                  <span>No deals in this tier</span>
                </div>
              ) : (
                tierDeals.map((deal) => (
                  <DealKanbanCard
                    key={deal.id}
                    deal={deal}
                    badgeClass={col.badgeClass}
                    onSelectDeal={onSelectDeal}
                    onOpenMeetingPrep={onOpenMeetingPrep}
                    onOpenProposal={onOpenProposal}
                    onOpenSandbox={onOpenSandbox}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
